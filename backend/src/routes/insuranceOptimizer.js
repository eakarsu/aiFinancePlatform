const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { paginatedQuery, bulkDelete, bulkUpdate, handleExport } = require('../utils/queryHelpers');

// Repair truncated JSON by closing open brackets/braces
function repairJSON(str) {
  try {
    JSON.parse(str);
    return str;
  } catch (e) {
    let fixed = str.replace(/,\s*$/, '');
    const opens = { '{': 0, '[': 0 };
    const closes = { '}': '{', ']': '[' };
    let inString = false;
    let escape = false;
    for (const ch of fixed) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') opens[ch]++;
      if (ch === '}' || ch === ']') opens[closes[ch]]--;
    }
    if (inString) fixed += '"';
    for (let i = 0; i < opens['[']; i++) fixed += ']';
    for (let i = 0; i < opens['{']; i++) fixed += '}';
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    return fixed;
  }
}

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
      max_tokens: 3000,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Get all insurance policies
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search } = req.query;
    const result = await paginatedQuery(prisma, 'insurancePolicy', {
      baseWhere: { userId: req.user.id },
      search,
      searchFields: ['insuranceType', 'provider', 'policyNumber', 'aiPremiumRating'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get insurance policies' });
  }
});

// Bulk delete
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'insurancePolicy', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'insurancePolicy', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'insurancePolicy', req.user.id, req.query, 'Insurance Policies', ['insuranceType', 'provider', 'policyNumber', 'coverageAmount', 'premium', 'deductible', 'aiCoverageScore', 'aiPremiumRating']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single policy
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const policy = await prisma.insurancePolicy.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get policy' });
  }
});

// Add insurance policy
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { insuranceType, provider, policyNumber, coverageAmount, premium,
            deductible, startDate, endDate, coverageDetails, beneficiaries } = req.body;

    const policy = await prisma.insurancePolicy.create({
      data: {
        userId: req.user.id,
        insuranceType,
        provider,
        policyNumber,
        coverageAmount,
        premium,
        deductible,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        coverageDetails,
        beneficiaries
      }
    });

    res.json(policy);
  } catch (error) {
    console.error('Add policy error:', error);
    res.status(500).json({ error: 'Failed to add policy' });
  }
});

// Update policy
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);

    const policy = await prisma.insurancePolicy.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data
    });
    if (policy.count === 0) return res.status(404).json({ error: 'Policy not found' });

    const updated = await prisma.insurancePolicy.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

// Delete policy
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.insurancePolicy.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

// AI Analyze single policy
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const policy = await prisma.insurancePolicy.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const prompt = `Analyze this insurance policy and provide optimization suggestions:

POLICY DETAILS:
- Type: ${policy.insuranceType}
- Provider: ${policy.provider || 'N/A'}
- Coverage Amount: $${policy.coverageAmount?.toLocaleString() || 'N/A'}
- Monthly Premium: $${policy.premium || 'N/A'}
- Deductible: $${policy.deductible || 'N/A'}
- Coverage Details: ${JSON.stringify(policy.coverageDetails || {})}
- Start Date: ${policy.startDate || 'N/A'}
- End Date: ${policy.endDate || 'N/A'}

Provide analysis in this JSON format:
{
  "aiCoverageScore": 75,
  "aiPremiumRating": "excellent|good|fair|poor",
  "aiSavingsPotential": 100,
  "analysis": {
    "summary": "Brief assessment of the policy",
    "coverageAssessment": "Is the coverage adequate?",
    "premiumAssessment": "Is the premium competitive?",
    "deductibleAssessment": "Is the deductible appropriate?"
  },
  "gaps": [
    {"gap": "Coverage gap description", "risk": "high|medium|low", "recommendation": "How to address"}
  ],
  "recommendations": [
    {"title": "Recommendation title", "description": "Detailed recommendation", "potentialSavings": 50, "priority": "high|medium|low"}
  ],
  "alternatives": [
    {"provider": "Alternative Provider", "estimatedPremium": 150, "coverage": "Coverage description", "pros": ["pro 1"], "cons": ["con 1"]}
  ],
  "tips": ["Tip 1 to save money", "Tip 2", "Tip 3"]
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert insurance advisor. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(repairJSON(jsonMatch[0]));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      await prisma.insurancePolicy.update({
        where: { id: policy.id },
        data: {
          aiCoverageScore: analysis.aiCoverageScore,
          aiPremiumRating: analysis.aiPremiumRating,
          aiSavingsPotential: analysis.aiSavingsPotential,
          aiGaps: analysis.gaps,
          aiRecommendations: analysis.recommendations,
          aiAlternatives: analysis.alternatives
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'insurance_optimizer',
        userId: req.user.id,
        inputData: { policy },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.aiCoverageScore || 0
      }
    });

    res.json({ policy, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Insurance analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze policy: ' + error.message });
  }
});

// AI Optimize all policies (portfolio view)
router.post('/optimize', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const policies = await prisma.insurancePolicy.findMany({
      where: { userId: req.user.id, isActive: true }
    });

    if (policies.length === 0) {
      return res.status(400).json({ error: 'No active policies to optimize' });
    }

    const policySummary = policies.map(p => ({
      type: p.insuranceType,
      provider: p.provider,
      coverage: p.coverageAmount,
      premium: p.premium,
      deductible: p.deductible
    }));

    const totalPremium = policies.reduce((sum, p) => sum + (p.premium || 0), 0);

    const prompt = `Analyze this insurance portfolio and provide comprehensive optimization:

CURRENT POLICIES:
${JSON.stringify(policySummary, null, 2)}

Total Monthly Premium: $${totalPremium}

Provide portfolio analysis in this JSON format:
{
  "portfolioScore": 70,
  "totalPremium": ${totalPremium},
  "optimizedPremium": ${totalPremium * 0.85},
  "potentialSavings": ${totalPremium * 0.15 * 12},
  "analysis": {
    "summary": "Overall assessment of the insurance portfolio",
    "diversification": "Assessment of coverage types",
    "overlaps": ["Any overlapping coverages"],
    "gaps": ["Any missing coverages"],
    "overinsured": ["Areas where coverage might be excessive"],
    "underinsured": ["Areas where coverage might be inadequate"]
  },
  "recommendations": [
    {"action": "Bundle policies", "description": "Explanation", "savings": 200, "priority": "high"}
  ],
  "suggestedPortfolio": [
    {"type": "health", "recommendedCoverage": 500000, "recommendedDeductible": 2000, "estimatedPremium": 300}
  ],
  "actionPlan": ["Step 1", "Step 2", "Step 3"]
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert insurance portfolio advisor. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(repairJSON(jsonMatch[0]));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'insurance_optimizer_portfolio',
        userId: req.user.id,
        inputData: { policies: policySummary },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.portfolioScore || 0
      }
    });

    res.json({ policies: policySummary, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Portfolio optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize portfolio: ' + error.message });
  }
});

module.exports = router;
