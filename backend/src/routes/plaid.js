const express = require('express');
const router = express.Router();
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

// Initialize Plaid client
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

// Auto-categorize a transaction description using keyword matching
function autoCategorizeTx(name = '', amount = 0) {
  const desc = name.toLowerCase();
  if (/uber|lyft|taxi|transit|metro|marta|bart/.test(desc)) return 'Transportation';
  if (/starbucks|coffee|dunkin|panera|chipotle|mcdonald|subway|pizza|restaurant|cafe|sushi/.test(desc)) return 'Food & Dining';
  if (/amazon|walmart|target|costco|kroger|whole foods|trader joe/.test(desc)) return 'Shopping';
  if (/netflix|spotify|hulu|disney|apple|google play|youtube premium/.test(desc)) return 'Subscriptions';
  if (/cvs|walgreen|pharmacy|rite aid/.test(desc)) return 'Health';
  if (/electric|gas|water|utility|pg&e|con ed|national grid/.test(desc)) return 'Utilities';
  if (/rent|mortgage|lease/.test(desc)) return 'Housing';
  if (/gym|planet fitness|equinox/.test(desc)) return 'Health & Fitness';
  if (/atm|cash|withdrawal/.test(desc)) return 'Cash & ATM';
  if (amount < 0) return 'Income';
  return 'Other';
}

// POST /api/plaid/link-token — creates a Plaid link token for the user
router.post('/link-token', authenticateToken, async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: 'AI Finance Platform',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    res.json({ linkToken: response.data.link_token, expiration: response.data.expiration });
  } catch (error) {
    console.error('Plaid link-token error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create Plaid link token' });
  }
});

// POST /api/plaid/exchange-token — exchanges public token for access token
router.post('/exchange-token', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { publicToken, institutionId, institutionName } = req.body;

    if (!publicToken) {
      return res.status(400).json({ error: 'publicToken is required' });
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token: accessToken, item_id: itemId } = exchangeResponse.data;

    // Fetch account details
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    const accounts = accountsResponse.data.accounts;
    const accountIds = accounts.map(a => a.account_id);

    // Store in DB (upsert on itemId). Encrypt accessToken at rest if PLAID_TOKEN_ENC_KEY is set.
    const encAccessToken = encrypt(accessToken);
    const existing = await prisma.plaidConnection.findFirst({ where: { itemId } });
    let connection;
    if (existing) {
      connection = await prisma.plaidConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: encAccessToken,
          accountIds,
          institutionId: institutionId || null,
          institutionName: institutionName || null,
          status: 'active',
          updatedAt: new Date(),
        },
      });
    } else {
      connection = await prisma.plaidConnection.create({
        data: {
          userId: req.user.id,
          accessToken: encAccessToken,
          itemId,
          institutionId: institutionId || null,
          institutionName: institutionName || null,
          accountIds,
          status: 'active',
        },
      });
    }

    res.json({
      success: true,
      connectionId: connection.id,
      institutionName: connection.institutionName,
      accountCount: accounts.length,
      accounts: accounts.map(a => ({
        accountId: a.account_id,
        name: a.name,
        officialName: a.official_name,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
      })),
    });
  } catch (error) {
    console.error('Plaid exchange-token error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange Plaid token' });
  }
});

// POST /api/plaid/sync — fetches recent transactions and stores in DB
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { connectionId, startDate, endDate, count = 100 } = req.body;

    // Load connection(s) for this user
    const whereClause = connectionId
      ? { id: connectionId, userId: req.user.id }
      : { userId: req.user.id, status: 'active' };

    const connections = await prisma.plaidConnection.findMany({ where: whereClause });
    if (!connections.length) {
      return res.status(404).json({ error: 'No active Plaid connections found' });
    }

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let totalImported = 0;
    let totalSkipped = 0;
    const results = [];

    for (const conn of connections) {
      try {
        // Decrypt the stored access token (no-op for plaintext legacy values)
        const accessToken = decrypt(conn.accessToken);
        const txResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: start,
          end_date: end,
          options: { count: Math.min(count, 500) },
        });

        const plaidTxs = txResponse.data.transactions;
        let imported = 0;
        let skipped = 0;

        for (const tx of plaidTxs) {
          // Map Plaid transaction to our Transaction model
          const category = tx.category?.[0] || autoCategorizeTx(tx.name, tx.amount);
          const txType = tx.amount < 0 ? 'DEPOSIT' : 'PURCHASE';

          try {
            // Use upsert keyed on plaid transaction_id stored in merchant field with prefix
            // (We store the plaid_tx_id in the deviceId field as a unique marker)
            const existingTx = await prisma.transaction.findFirst({
              where: { userId: req.user.id, deviceId: `plaid:${tx.transaction_id}` },
            });

            if (existingTx) {
              skipped++;
              continue;
            }

            await prisma.transaction.create({
              data: {
                userId: req.user.id,
                type: txType,
                amount: Math.abs(tx.amount),
                currency: tx.iso_currency_code || 'USD',
                merchant: tx.merchant_name || tx.name,
                category: autoCategorizeTx(tx.name || tx.merchant_name, tx.amount),
                location: tx.location?.city ? `${tx.location.city}, ${tx.location.region || ''}`.trim() : null,
                deviceId: `plaid:${tx.transaction_id}`,
                reviewStatus: 'APPROVED',
              },
            });
            imported++;
          } catch (txError) {
            console.error('Failed to store tx:', tx.transaction_id, txError.message);
          }
        }

        // Update lastSync timestamp
        await prisma.plaidConnection.update({
          where: { id: conn.id },
          data: { lastSync: new Date() },
        });

        totalImported += imported;
        totalSkipped += skipped;
        results.push({
          connectionId: conn.id,
          institutionName: conn.institutionName,
          fetched: plaidTxs.length,
          imported,
          skipped,
        });
      } catch (connError) {
        console.error(`Plaid sync error for connection ${conn.id}:`, connError.response?.data || connError.message);
        // Mark connection as errored if Plaid returns item error
        if (connError.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
          await prisma.plaidConnection.update({
            where: { id: conn.id },
            data: { status: 'expired' },
          });
        }
        results.push({ connectionId: conn.id, error: connError.response?.data?.error_message || connError.message });
      }
    }

    res.json({
      success: true,
      syncPeriod: { start, end },
      totalImported,
      totalSkipped,
      connections: results,
    });
  } catch (error) {
    console.error('Plaid sync error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to sync Plaid transactions' });
  }
});

// GET /api/plaid/accounts — returns linked accounts with balances
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const connections = await prisma.plaidConnection.findMany({
      where: { userId: req.user.id, status: 'active' },
    });

    if (!connections.length) {
      return res.json({ connections: [], accounts: [], totalBalance: 0 });
    }

    const allAccounts = [];
    const connectionSummaries = [];

    for (const conn of connections) {
      try {
        const accountsResponse = await plaidClient.accountsGet({ access_token: decrypt(conn.accessToken) });
        const accounts = accountsResponse.data.accounts.map(a => ({
          accountId: a.account_id,
          connectionId: conn.id,
          institutionName: conn.institutionName,
          name: a.name,
          officialName: a.official_name,
          type: a.type,
          subtype: a.subtype,
          mask: a.mask,
          balances: {
            available: a.balances.available,
            current: a.balances.current,
            limit: a.balances.limit,
            currency: a.balances.iso_currency_code || 'USD',
          },
        }));
        allAccounts.push(...accounts);
        connectionSummaries.push({
          id: conn.id,
          institutionName: conn.institutionName,
          status: conn.status,
          lastSync: conn.lastSync,
          accountCount: accounts.length,
        });
      } catch (connError) {
        console.error(`Failed to get accounts for connection ${conn.id}:`, connError.response?.data || connError.message);
        connectionSummaries.push({
          id: conn.id,
          institutionName: conn.institutionName,
          status: 'error',
          error: connError.response?.data?.error_message || connError.message,
        });
      }
    }

    const totalBalance = allAccounts
      .filter(a => a.type === 'depository')
      .reduce((sum, a) => sum + (a.balances.current || 0), 0);

    res.json({
      connections: connectionSummaries,
      accounts: allAccounts,
      totalBalance,
    });
  } catch (error) {
    console.error('Plaid accounts error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get Plaid accounts' });
  }
});

// GET /api/plaid/connections — list user's Plaid connections
router.get('/connections', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const connections = await prisma.plaidConnection.findMany({
      where: { userId: req.user.id },
      select: {
        id: true, itemId: true, institutionId: true, institutionName: true,
        status: true, lastSync: true, createdAt: true, updatedAt: true,
        consentExpiry: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ connections });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

// POST /api/plaid/connect — stub: create a pending PlaidConnection and return a mock link_token
router.post('/connect', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { institutionName, institutionId } = req.body;

    // Create a pending connection record so the PlaidConnection model is exercised
    const mockItemId = `mock_item_${Date.now()}_${req.user.id}`;
    const connection = await prisma.plaidConnection.create({
      data: {
        userId: req.user.id,
        accessToken: encrypt(`mock_access_token_${mockItemId}`),
        itemId: mockItemId,
        institutionId: institutionId || null,
        institutionName: institutionName || 'Demo Bank',
        accountIds: [],
        status: 'pending',
      },
    });

    // Return a mock link_token for UI testing (no real Plaid call)
    const mockLinkToken = `link-sandbox-mock-${connection.id}-${Date.now()}`;

    res.status(201).json({
      success: true,
      connectionId: connection.id,
      link_token: mockLinkToken,
      expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      status: 'pending',
      message: 'Mock link token created. Use the real /link-token endpoint for live Plaid integration.',
    });
  } catch (error) {
    console.error('Plaid connect stub error:', error);
    res.status(500).json({ error: 'Failed to create Plaid connection' });
  }
});

// PUT /api/plaid/connections/:id/disconnect — mark a connection as inactive
router.put('/connections/:id/disconnect', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const connection = await prisma.plaidConnection.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const updated = await prisma.plaidConnection.update({
      where: { id: connection.id },
      data: { status: 'inactive', updatedAt: new Date() },
    });

    res.json({
      success: true,
      connection: {
        id: updated.id,
        institutionName: updated.institutionName,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
      message: 'Connection marked as inactive.',
    });
  } catch (error) {
    console.error('Plaid disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Plaid connection' });
  }
});

// DELETE /api/plaid/connections/:id — remove a Plaid connection
router.delete('/connections/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const connection = await prisma.plaidConnection.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    // Remove item from Plaid
    try {
      await plaidClient.itemRemove({ access_token: decrypt(connection.accessToken) });
    } catch (plaidErr) {
      console.warn('Plaid item remove warning:', plaidErr.response?.data || plaidErr.message);
    }

    await prisma.plaidConnection.delete({ where: { id: connection.id } });
    res.json({ success: true, message: 'Plaid connection removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

module.exports = router;
