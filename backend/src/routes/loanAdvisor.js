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

// Get all loan applications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search } = req.query;
    const result = await paginatedQuery(prisma, 'loanApplication', {
      baseWhere: { userId: req.user.id },
      search,
      searchFields: ['loanType', 'loanPurpose', 'status', 'employmentStatus'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get loan applications' });
  }
});

// Bulk delete
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'loanApplication', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'loanApplication', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'loanApplication', req.user.id, req.query, 'Loan Applications', ['loanType', 'loanAmount', 'loanPurpose', 'loanTerm', 'creditScore', 'status', 'aiApprovalLikelihood', 'aiRecommendedRate']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single loan
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const loan = await prisma.loanApplication.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!loan) return res.status(404).json({ error: 'Loan application not found' });
    res.json(loan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get loan' });
  }
});

// Create loan application
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { loanType, loanAmount, loanPurpose, loanTerm, desiredRate, annualIncome,
            employmentStatus, employmentYears, creditScore, existingDebts,
            monthlyExpenses, collateralValue, downPayment } = req.body;

    const loan = await prisma.loanApplication.create({
      data: {
        userId: req.user.id,
        loanType,
        loanAmount,
        loanPurpose,
        loanTerm: loanTerm || 60,
        desiredRate,
        annualIncome,
        employmentStatus,
        employmentYears,
        creditScore,
        existingDebts,
        monthlyExpenses,
        collateralValue,
        downPayment
      }
    });

    res.json(loan);
  } catch (error) {
    console.error('Create loan error:', error);
    res.status(500).json({ error: 'Failed to create loan application' });
  }
});

// Update loan
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const loan = await prisma.loanApplication.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: req.body
    });
    if (loan.count === 0) return res.status(404).json({ error: 'Loan not found' });

    const updated = await prisma.loanApplication.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update loan' });
  }
});

// Delete loan
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.loanApplication.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete loan' });
  }
});

// AI Analyze loan application
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const loan = await prisma.loanApplication.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const prompt = `Analyze this loan application and provide comprehensive advice:

LOAN REQUEST:
- Loan Type: ${loan.loanType}
- Loan Amount: $${loan.loanAmount?.toLocaleString()}
- Purpose: ${loan.loanPurpose || 'N/A'}
- Desired Term: ${loan.loanTerm} months
- Desired Rate: ${loan.desiredRate ? loan.desiredRate + '%' : 'Best available'}

APPLICANT PROFILE:
- Annual Income: $${loan.annualIncome?.toLocaleString() || 'N/A'}
- Employment Status: ${loan.employmentStatus || 'N/A'}
- Years Employed: ${loan.employmentYears || 'N/A'}
- Credit Score: ${loan.creditScore || 'N/A'}
- Existing Debts: $${loan.existingDebts?.toLocaleString() || 0}
- Monthly Expenses: $${loan.monthlyExpenses?.toLocaleString() || 'N/A'}
- Collateral Value: $${loan.collateralValue?.toLocaleString() || 'None'}
- Down Payment: $${loan.downPayment?.toLocaleString() || 0}

Calculate DTI (Debt-to-Income) ratio and provide analysis in this JSON format:
{
  "aiApprovalLikelihood": 75,
  "aiRecommendedRate": 7.5,
  "aiRecommendedTerm": 60,
  "aiMonthlyPayment": 500,
  "aiTotalInterest": 5000,
  "analysis": {
    "summary": "Brief assessment of the loan application",
    "dtiRatio": 35,
    "dtiAssessment": "Assessment of debt-to-income ratio",
    "creditAssessment": "Assessment of creditworthiness",
    "affordabilityAssessment": "Can the applicant afford this loan?",
    "strengths": ["strength 1", "strength 2"],
    "concerns": ["concern 1", "concern 2"],
    "recommendations": ["recommendation 1", "recommendation 2"],
    "alternatives": [
      {"option": "Alternative option 1", "benefit": "Why this might be better"}
    ]
  },
  "bestLenders": [
    {"name": "Lender 1", "type": "Bank/Credit Union/Online", "estimatedRate": 6.5, "pros": ["pro 1"], "cons": ["con 1"]},
    {"name": "Lender 2", "type": "Bank/Credit Union/Online", "estimatedRate": 7.0, "pros": ["pro 1"], "cons": ["con 1"]},
    {"name": "Lender 3", "type": "Bank/Credit Union/Online", "estimatedRate": 7.5, "pros": ["pro 1"], "cons": ["con 1"]}
  ],
  "actionItems": ["Step 1 to improve application", "Step 2", "Step 3"]
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert loan advisor. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(repairJSON(jsonMatch[0]));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      await prisma.loanApplication.update({
        where: { id: loan.id },
        data: {
          aiApprovalLikelihood: analysis.aiApprovalLikelihood,
          aiRecommendedRate: analysis.aiRecommendedRate,
          aiRecommendedTerm: analysis.aiRecommendedTerm,
          aiMonthlyPayment: analysis.aiMonthlyPayment,
          aiTotalInterest: analysis.aiTotalInterest,
          aiAnalysis: analysis.analysis,
          aiBestLenders: analysis.bestLenders
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'loan_advisor',
        userId: req.user.id,
        inputData: { loan },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.aiApprovalLikelihood || 0
      }
    });

    res.json({ loan, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Loan analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze loan: ' + error.message });
  }
});

// Calculate loan payments
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { loanAmount, interestRate, loanTerm } = req.body;

    const monthlyRate = interestRate / 100 / 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) /
                          (Math.pow(1 + monthlyRate, loanTerm) - 1);
    const totalPayment = monthlyPayment * loanTerm;
    const totalInterest = totalPayment - loanAmount;

    res.json({
      loanAmount,
      interestRate,
      loanTerm,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalPayment: Math.round(totalPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate loan' });
  }
});

module.exports = router;
