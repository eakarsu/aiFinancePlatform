const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { paginatedQuery, bulkDelete, bulkUpdate, handleExport } = require('../utils/queryHelpers');

// OpenRouter AI helper
async function callOpenRouter(prompt, systemPrompt = '') {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: 2500,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// CSV parsing helper
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

// Parse CSV line handling quoted values
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values.map(v => v.replace(/^["']|["']$/g, ''));
}

// Map CSV columns to transaction fields
function mapCSVToTransaction(row, mapping) {
  const transaction = {
    type: 'PURCHASE',
    amount: 0,
    merchant: null,
    category: null,
    location: null,
    description: null
  };

  // Standard field mappings
  const fieldMappings = {
    amount: ['amount', 'transaction_amount', 'value', 'price', 'cost', 'debit', 'credit'],
    merchant: ['merchant', 'merchant_name', 'vendor', 'payee', 'description', 'name'],
    category: ['category', 'merchant_category', 'type', 'category_name'],
    date: ['date', 'transaction_date', 'posted_date', 'transaction date'],
    location: ['location', 'city', 'merchant_city', 'place'],
    description: ['description', 'memo', 'notes', 'reference']
  };

  // Apply custom mapping if provided, otherwise use auto-detection
  Object.keys(fieldMappings).forEach(field => {
    if (mapping && mapping[field]) {
      transaction[field] = row[mapping[field]];
    } else {
      // Auto-detect
      for (const possibleCol of fieldMappings[field]) {
        if (row[possibleCol] !== undefined && row[possibleCol] !== '') {
          transaction[field] = row[possibleCol];
          break;
        }
      }
    }
  });

  // Parse amount
  if (transaction.amount) {
    // Remove currency symbols and parse
    const amountStr = String(transaction.amount).replace(/[$,]/g, '');
    transaction.amount = Math.abs(parseFloat(amountStr)) || 0;
  }

  // Determine transaction type based on amount sign
  if (row.debit && parseFloat(String(row.debit).replace(/[$,]/g, '')) > 0) {
    transaction.type = 'PURCHASE';
    transaction.amount = Math.abs(parseFloat(String(row.debit).replace(/[$,]/g, '')));
  } else if (row.credit && parseFloat(String(row.credit).replace(/[$,]/g, '')) > 0) {
    transaction.type = 'DEPOSIT';
    transaction.amount = Math.abs(parseFloat(String(row.credit).replace(/[$,]/g, '')));
  }

  // Parse date
  if (transaction.date) {
    transaction.createdAt = new Date(transaction.date);
    if (isNaN(transaction.createdAt.getTime())) {
      transaction.createdAt = new Date();
    }
  }

  return transaction;
}

// Import transactions from CSV
router.post('/csv', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { csvContent, mapping, skipDuplicates = true } = req.body;

    if (!csvContent) {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    // Create import record
    const importRecord = await prisma.transactionImport.create({
      data: {
        userId: req.user.id,
        source: 'csv',
        status: 'PROCESSING',
        startedAt: new Date()
      }
    });

    // Parse CSV
    const { headers, rows } = parseCSV(csvContent);

    if (rows.length === 0) {
      await prisma.transactionImport.update({
        where: { id: importRecord.id },
        data: { status: 'FAILED', errorLog: { message: 'No valid rows found in CSV' } }
      });
      return res.status(400).json({ error: 'No valid rows found in CSV' });
    }

    // Update total records
    await prisma.transactionImport.update({
      where: { id: importRecord.id },
      data: { totalRecords: rows.length }
    });

    const results = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      try {
        const transaction = mapCSVToTransaction(rows[i], mapping);

        // Skip if amount is 0 or invalid
        if (!transaction.amount || transaction.amount <= 0) {
          results.skipped++;
          results.errors.push({ row: i + 2, error: 'Invalid amount' });
          continue;
        }

        // Check for duplicates
        if (skipDuplicates) {
          const existing = await prisma.transaction.findFirst({
            where: {
              userId: req.user.id,
              amount: transaction.amount,
              merchant: transaction.merchant,
              createdAt: transaction.createdAt
            }
          });

          if (existing) {
            results.skipped++;
            continue;
          }
        }

        // Create transaction
        await prisma.transaction.create({
          data: {
            userId: req.user.id,
            type: transaction.type,
            amount: transaction.amount,
            merchant: transaction.merchant,
            category: transaction.category,
            location: transaction.location
          }
        });

        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 2, error: err.message });
      }
    }

    // Update import record
    const finalStatus = results.failed > 0 && results.imported === 0 ? 'FAILED' :
                       results.failed > 0 ? 'PARTIAL' : 'COMPLETED';

    await prisma.transactionImport.update({
      where: { id: importRecord.id },
      data: {
        status: finalStatus,
        processedRecords: results.imported,
        failedRecords: results.failed,
        completedAt: new Date(),
        summary: results,
        errorLog: results.errors.length > 0 ? results.errors : null
      }
    });

    res.json({
      importId: importRecord.id,
      status: finalStatus,
      results,
      detectedHeaders: headers
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// Get import history (paginated, searchable)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search } = req.query;
    const result = await paginatedQuery(prisma, 'transactionImport', {
      baseWhere: { userId: req.user.id },
      search,
      searchFields: ['source', 'fileName', 'status'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get import history' });
  }
});

// Bulk delete transaction imports
router.post('/history/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'transactionImport', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update transaction imports
router.patch('/history/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'transactionImport', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export transaction imports
router.get('/history/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'transactionImport', req.user.id, req.query, 'Transaction Imports', ['source', 'fileName', 'status', 'totalRecords', 'processedRecords', 'failedRecords', 'createdAt']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get import details
router.get('/history/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const importRecord = await prisma.transactionImport.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    res.json(importRecord);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get import details' });
  }
});

// Plaid: Create link token
router.post('/plaid/link-token', authenticateToken, async (req, res) => {
  try {
    // In production, this would call Plaid API
    // const plaidClient = require('../utils/plaidClient');
    // const response = await plaidClient.linkTokenCreate({
    //   user: { client_user_id: req.user.id },
    //   client_name: 'AI Finance Platform',
    //   products: ['transactions'],
    //   country_codes: ['US'],
    //   language: 'en'
    // });

    // For MVP, return mock response
    res.json({
      link_token: 'mock-link-token-' + Date.now(),
      expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      request_id: 'mock-request-' + Math.random().toString(36).substr(2, 9),
      message: 'Plaid integration requires API keys. Configure PLAID_CLIENT_ID and PLAID_SECRET in .env'
    });
  } catch (error) {
    console.error('Plaid link token error:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Plaid: Exchange public token for access token
router.post('/plaid/exchange-token', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { publicToken, institutionId, institutionName } = req.body;

    // In production, this would:
    // 1. Exchange public token for access token via Plaid API
    // 2. Store encrypted access token
    // 3. Fetch initial transaction data

    // For MVP, create mock connection
    const connection = await prisma.plaidConnection.create({
      data: {
        userId: req.user.id,
        accessToken: 'encrypted-mock-token',
        itemId: 'mock-item-' + Date.now(),
        institutionId: institutionId || 'mock-institution',
        institutionName: institutionName || 'Mock Bank',
        status: 'active'
      }
    });

    res.json({
      success: true,
      connectionId: connection.id,
      institutionName: connection.institutionName,
      message: 'Bank connection created (mock mode)'
    });
  } catch (error) {
    console.error('Plaid exchange error:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Plaid: Get connected accounts
router.get('/plaid/accounts', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const connections = await prisma.plaidConnection.findMany({
      where: { userId: req.user.id, status: 'active' }
    });

    res.json(connections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// Plaid: Sync transactions
router.post('/plaid/sync', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { connectionId } = req.body;

    const connection = await prisma.plaidConnection.findFirst({
      where: { id: connectionId, userId: req.user.id }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // In production, this would fetch transactions from Plaid API
    // For MVP, generate mock transactions

    const mockTransactions = [
      { type: 'PURCHASE', amount: 45.99, merchant: 'Amazon', category: 'Shopping' },
      { type: 'PURCHASE', amount: 12.50, merchant: 'Starbucks', category: 'Food & Drink' },
      { type: 'PURCHASE', amount: 89.00, merchant: 'Whole Foods', category: 'Groceries' },
      { type: 'DEPOSIT', amount: 2500.00, merchant: 'Payroll', category: 'Income' },
      { type: 'PURCHASE', amount: 150.00, merchant: 'Electric Company', category: 'Utilities' }
    ];

    let imported = 0;
    for (const tx of mockTransactions) {
      await prisma.transaction.create({
        data: {
          userId: req.user.id,
          ...tx,
          location: 'Synced via Plaid'
        }
      });
      imported++;
    }

    // Update last sync
    await prisma.plaidConnection.update({
      where: { id: connectionId },
      data: { lastSync: new Date() }
    });

    res.json({
      success: true,
      transactionsImported: imported,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    console.error('Plaid sync error:', error);
    res.status(500).json({ error: 'Failed to sync transactions' });
  }
});

// Plaid: Disconnect account
router.delete('/plaid/:connectionId', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const result = await prisma.plaidConnection.updateMany({
      where: { id: req.params.connectionId, userId: req.user.id },
      data: { status: 'disconnected' }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// AI-powered transaction analysis
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ error: 'AI analysis requires OPENROUTER_API_KEY' });
    }

    // Get recent transactions
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    if (transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions to analyze. Import some transactions first.' });
    }

    // Summarize transactions for AI
    const totalSpent = transactions.filter(t => t.type === 'PURCHASE').reduce((s, t) => s + t.amount, 0);
    const totalDeposited = transactions.filter(t => t.type === 'DEPOSIT').reduce((s, t) => s + t.amount, 0);
    const categories = {};
    const merchants = {};
    transactions.forEach(t => {
      if (t.category) categories[t.category] = (categories[t.category] || 0) + t.amount;
      if (t.merchant) merchants[t.merchant] = (merchants[t.merchant] || 0) + t.amount;
    });

    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topMerchants = Object.entries(merchants).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Sample of individual transactions for pattern detection
    const txSample = transactions.slice(0, 30).map(t => ({
      type: t.type, amount: t.amount, merchant: t.merchant, category: t.category,
      date: t.createdAt?.toISOString?.()?.split('T')[0]
    }));

    const prompt = `Analyze these financial transactions and provide comprehensive insights.

Summary:
- Total Transactions: ${transactions.length}
- Total Spending: $${totalSpent.toFixed(2)}
- Total Deposits: $${totalDeposited.toFixed(2)}
- Net Cash Flow: $${(totalDeposited - totalSpent).toFixed(2)}

Top Categories by Spend:
${topCategories.map(([cat, amt]) => `  ${cat}: $${amt.toFixed(2)}`).join('\n')}

Top Merchants by Spend:
${topMerchants.map(([m, amt]) => `  ${m}: $${amt.toFixed(2)}`).join('\n')}

Sample Transactions:
${JSON.stringify(txSample, null, 2)}

Respond in JSON:
{
  "summary": "2-3 sentence overall spending analysis",
  "healthScore": 75,
  "monthlyBurnRate": 0,
  "spendingPatterns": [
    { "pattern": "pattern name", "description": "explanation", "type": "good|warning|concern" }
  ],
  "categoryInsights": [
    { "category": "name", "assessment": "over_spending|normal|under_spending", "suggestion": "advice" }
  ],
  "anomalies": [
    { "description": "unusual transaction or pattern", "severity": "high|medium|low" }
  ],
  "savingsOpportunities": [
    { "title": "opportunity", "potentialSavings": 50, "description": "how to save" }
  ],
  "budgetRecommendation": {
    "suggestedMonthlyBudget": 0,
    "breakdown": [{"category": "name", "suggested": 0, "current": 0}]
  }
}

Provide 3-5 spending patterns, 3-5 category insights, 2-3 anomalies, and 3-4 savings opportunities.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert financial analyst specializing in personal spending analysis and budgeting. Analyze transaction data to find patterns, anomalies, and savings opportunities. Always respond in valid JSON.');
    const analysis = JSON.parse(aiResponse.replace(/```json\n?|```\n?/g, '').trim());

    res.json({
      analysis,
      transactionCount: transactions.length,
      totalSpent,
      totalDeposited,
      topCategories: topCategories.map(([cat, amt]) => ({ category: cat, amount: amt })),
      topMerchants: topMerchants.map(([m, amt]) => ({ merchant: m, amount: amt }))
    });
  } catch (error) {
    console.error('Transaction analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze transactions' });
  }
});

// Get sample CSV template
router.get('/csv/template', (req, res) => {
  const template = `Date,Description,Amount,Category,Merchant
2024-01-15,Coffee at Starbucks,5.75,Food & Drink,Starbucks
2024-01-15,Grocery shopping,89.50,Groceries,Whole Foods
2024-01-16,Gas station,45.00,Transportation,Shell
2024-01-16,Online purchase,125.99,Shopping,Amazon
2024-01-17,Electricity bill,150.00,Utilities,PG&E`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transaction_template.csv');
  res.send(template);
});

module.exports = router;
