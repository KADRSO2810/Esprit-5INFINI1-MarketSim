import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CompanyFundamentalOverview,
  CompanyFinancialStatements,
  CompanyComparison,
  FinancialRatioItem,
} from '../api/fundamentals';

// Couleurs institutionnelles
const C_NAVY = [11, 26, 43] as [number, number, number];        // #0B1A2B
const C_BLUE = [14, 116, 144] as [number, number, number];      // #0E7490
const C_DARK = [15, 23, 42] as [number, number, number];        // #0F172A
const C_EMERALD = [16, 185, 129] as [number, number, number];  // #10B981
const C_MUTED = [100, 116, 139] as [number, number, number];   // #64748B
const C_LIGHT = [248, 250, 252] as [number, number, number];   // #F8FAFC
const C_BORDER = [226, 232, 240] as [number, number, number];  // #E2E8F0

function formatBillion(val?: number | null): string {
  if (val == null) return 'N/A';
  const b = val / 1_000_000_000;
  return `$${b.toFixed(2)}B`;
}

function formatMillion(val?: number | null): string {
  if (val == null) return 'N/A';
  const m = val / 1_000_000;
  return `$${m.toFixed(1)}M`;
}

function formatPct(val?: number | null): string {
  if (val == null) return 'N/A';
  return `${(val * 100).toFixed(2)}%`;
}

/**
 * Génère un rapport PDF complet de recherche fondamentale pour une entreprise (Fiche Entreprise).
 * Tout le contenu est intégralement structuré et paginé, sans barres de défilement ni coupures.
 */
export function generateCompanyFundamentalPdf(
  overview: CompanyFundamentalOverview,
  statements: CompanyFinancialStatements | null,
  frequency: 'ANNUAL' | 'QUARTERLY'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const symbol = overview.symbol;
  const profile = overview.profile;
  const freqLabel = frequency === 'ANNUAL' ? 'Annuel (SEC Form 10-K)' : 'Trimestriel (SEC Form 10-Q)';
  const nowStr = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let curY = margin + 14;

  // ── 1. EN-TÊTE PRINCIPAL (Page 1) ──────────────────────────────────────────
  doc.setFillColor(...C_DARK);
  doc.roundedRect(margin, curY, contentWidth, 34, 3, 3, 'F');

  // Badge catégorie
  doc.setFillColor(...C_BLUE);
  doc.roundedRect(margin + 5, curY + 5, 58, 5.5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('EQUITY RESEARCH & SEC FILINGS', margin + 7, curY + 9);

  // Nom entreprise & Ticker
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const companyTitle = `${profile?.name || symbol} (${symbol})`;
  doc.text(companyTitle, margin + 5, curY + 19);

  // Sous-titre métadonnées
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const metaLine = `Bourse : ${profile?.exchange || 'US Exchanges'}  |  Secteur : ${profile?.finnhubIndustry || profile?.sector || 'Général'}  |  Pays : ${profile?.country || 'US'}  |  Devise : ${profile?.currency || 'USD'}`;
  doc.text(metaLine, margin + 5, curY + 25);

  // Prix Live & Market Cap (à droite dans la boîte)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C_EMERALD);
  const priceText = overview.currentPrice != null ? `$${overview.currentPrice.toFixed(2)}` : 'N/A';
  doc.text(priceText, pageWidth - margin - 5, curY + 15, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('COURS LIVE NYSE/NASDAQ', pageWidth - margin - 5, curY + 20, { align: 'right' });

  const capText = profile?.marketCapitalization != null ? `$${(profile.marketCapitalization / 1000).toFixed(2)}B` : 'N/A';
  doc.text(`Cap. Boursière : ${capText}`, pageWidth - margin - 5, curY + 26, { align: 'right' });

  curY += 38;

  // ── 2. CARTOUCHES EXÉCUTIFS (KPIS 4x2) ─────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C_NAVY);
  doc.text('INDICATEURS CLÉS DE PERFORMANCE & RENTABILITÉ', margin, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text(`Données de synthèse basées sur le dernier dépôt officiel ${freqLabel}`, margin + 95, curY);

  curY += 4;

  const kpis = [
    { label: "Chiffre d'Affaires", val: formatBillion(overview.latestRevenue), sub: "Dernier exercice" },
    { label: "Résultat Net", val: formatBillion(overview.latestNetIncome), sub: "Part du groupe" },
    { label: "BPA Dilué (EPS)", val: overview.latestEps != null ? `$${overview.latestEps.toFixed(2)}` : 'N/A', sub: "Bénéfice par action" },
    { label: "P/E Ratio", val: overview.peRatio != null ? `${overview.peRatio.toFixed(2)}x` : 'N/A', sub: "Multiple cours/bénéfice" },
    { label: "ROE (Capitaux Propres)", val: formatPct(overview.roe), sub: "Rendement des CP" },
    { label: "Debt-to-Equity (D/E)", val: overview.debtToEquity != null ? overview.debtToEquity.toFixed(2) : 'N/A', sub: "Levier d'endettement" },
    { label: "Croissance CA YoY", val: formatPct(overview.revenueGrowthYoY), sub: "Sur 12 mois glissants" },
    { label: "Free Cash Flow (FCF)", val: formatBillion(overview.freeCashFlow), sub: "Flux disponible réel" },
  ];

  const cardW = (contentWidth - 3 * 3) / 4;
  const cardH = 15;

  kpis.forEach((kpi, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = margin + col * (cardW + 3);
    const y = curY + row * (cardH + 2.5);

    doc.setFillColor(...C_LIGHT);
    doc.setDrawColor(...C_BORDER);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_MUTED);
    doc.text(kpi.label.toUpperCase(), x + 2.5, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_NAVY);
    doc.text(kpi.val, x + 2.5, y + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, x + 2.5, y + 13);
  });

  curY += 2 * cardH + 8;

  // ── 3. ÉTAT FINANCIER 1 : COMPTE DE RÉSULTAT (INCOME STATEMENT) ───────────
  if (statements?.incomeStatements && statements.incomeStatements.length > 0) {
    const stmts = statements.incomeStatements;
    const periods = stmts.map((s) => s.periodLabel);

    const head = [['Poste Comptable (En Millions USD)', ...periods]];
    const body = [
      ['Chiffre d’Affaires Total (Revenues)', ...stmts.map((s) => formatMillion(s.revenue))],
      ['Coût des Ventes (COGS)', ...stmts.map((s) => formatMillion(s.costOfGoodsSold))],
      ['Marge Brute (Gross Profit)', ...stmts.map((s) => formatMillion(s.grossProfit))],
      ['Recherche & Développement (R&D)', ...stmts.map((s) => formatMillion(s.researchAndDevelopment))],
      ['Frais Généraux & Vente (SG&A)', ...stmts.map((s) => formatMillion(s.sellingGeneralAdmin))],
      ['Résultat d’Exploitation (Operating Income)', ...stmts.map((s) => formatMillion(s.operatingIncome))],
      ['EBITDA Normalisé', ...stmts.map((s) => formatMillion(s.ebitda))],
      ['Intérêts Nets & Frais Financiers', ...stmts.map((s) => formatMillion(s.netInterestExpense))],
      ['Impôt sur les Sociétés', ...stmts.map((s) => formatMillion(s.incomeTax))],
      ['Résultat Net Attribuable (Net Income)', ...stmts.map((s) => formatMillion(s.netIncome))],
      ['BPA Dilué ($ / action)', ...stmts.map((s) => s.epsDiluted != null ? `$${s.epsDiluted.toFixed(2)}` : 'N/A')],
      ['Marge Brute (%)', ...stmts.map((s) => formatPct(s.grossMarginPct))],
      ['Marge d’Exploitation (%)', ...stmts.map((s) => formatPct(s.operatingMarginPct))],
      ['Marge Nette (%)', ...stmts.map((s) => formatPct(s.netMarginPct))],
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...C_NAVY);
    doc.text('COMPTE DE RÉSULTAT DÉTAILLÉ (INCOME STATEMENT)', margin, curY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`Source : Dépôts certifiés SEC EDGAR (${freqLabel})`, margin + 115, curY);

    curY += 2;

    autoTable(doc, {
      startY: curY,
      margin: { left: margin, right: margin },
      head: head,
      body: body,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
        lineColor: C_BORDER,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: C_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'right',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowText = String((data.row.raw as any)?.[0] || '');
          if (rowText.includes('Chiffre d’Affaires') || rowText.includes('Résultat Net Attribuable')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 249, 255];
            if (data.column.index > 0) {
              data.cell.styles.textColor = C_NAVY;
            }
          }
          if (rowText.includes('Marge')) {
            data.cell.styles.fontStyle = 'italic';
          }
          if (data.column.index > 0) {
            data.cell.styles.halign = 'right';
          }
        }
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 4. BILAN COMPTABLE (BALANCE SHEET) ────────────────────────────────────
  doc.addPage();
  curY = margin + 14;

  if (statements?.balanceSheets && statements.balanceSheets.length > 0) {
    const bstmts = statements.balanceSheets;
    const periods = bstmts.map((s) => s.periodLabel);

    const bHead = [['Structure du Bilan (En Millions USD)', ...periods]];
    const bBody = [
      ['Trésorerie & Équivalents de Cash', ...bstmts.map((s) => formatMillion(s.cashAndEquivalents))],
      ['Investissements Court Terme', ...bstmts.map((s) => formatMillion(s.shortTermInvestments))],
      ['Créances Clients (Accounts Receivable)', ...bstmts.map((s) => formatMillion(s.accountsReceivable))],
      ['Stocks & Inventaires', ...bstmts.map((s) => formatMillion(s.inventory))],
      ['Actif Circulant Total (Current Assets)', ...bstmts.map((s) => formatMillion(s.currentAssets))],
      ['Immobilisations Corporelles Net (PP&E)', ...bstmts.map((s) => formatMillion(s.propertyPlantEquipmentNet))],
      ['Actifs Incorporels & Goodwill', ...bstmts.map((s) => formatMillion(s.intangibleAssets))],
      ['TOTAL DE L’ACTIF (TOTAL ASSETS)', ...bstmts.map((s) => formatMillion(s.totalAssets))],
      ['Dettes Fournisseurs (Accounts Payable)', ...bstmts.map((s) => formatMillion(s.accountsPayable))],
      ['Dette à Court Terme', ...bstmts.map((s) => formatMillion(s.shortTermDebt))],
      ['Passif Circulant Total (Current Liabilities)', ...bstmts.map((s) => formatMillion(s.currentLiabilities))],
      ['Dette à Long Terme', ...bstmts.map((s) => formatMillion(s.longTermDebt))],
      ['DETTE TOTALE BRUTE (TOTAL DEBT)', ...bstmts.map((s) => formatMillion(s.totalDebt))],
      ['TOTAL DU PASSIF (TOTAL LIABILITIES)', ...bstmts.map((s) => formatMillion(s.totalLiabilities))],
      ['Bénéfices Non Distribués (Retained Earnings)', ...bstmts.map((s) => formatMillion(s.retainedEarnings))],
      ['CAPITAUX PROPRES (STOCKHOLDERS’ EQUITY)', ...bstmts.map((s) => formatMillion(s.totalStockholdersEquity))],
      ['Fonds de Roulement Net (Working Capital)', ...bstmts.map((s) => formatMillion(s.workingCapital))],
      ['Dette Nette (Dette Totale - Trésorerie)', ...bstmts.map((s) => formatMillion(s.netDebt))],
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...C_NAVY);
    doc.text('BILAN COMPTABLE AUDITÉ (BALANCE SHEET)', margin, curY);

    curY += 2;

    autoTable(doc, {
      startY: curY,
      margin: { left: margin, right: margin },
      head: bHead,
      body: bBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.6,
        textColor: [30, 41, 59],
        lineColor: C_BORDER,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: C_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'right',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowText = String((data.row.raw as any)?.[0] || '');
          if (rowText.includes('TOTAL') || rowText.includes('CAPITAUX PROPRES')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
            if (data.column.index > 0) {
              data.cell.styles.textColor = C_NAVY;
            }
          }
          if (data.column.index > 0) {
            data.cell.styles.halign = 'right';
          }
        }
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 5. TABLEAU DES FLUX DE TRÉSORERIE (CASH FLOW STATEMENT) ───────────────
  if (statements?.cashFlowStatements && statements.cashFlowStatements.length > 0) {
    const cfstmts = statements.cashFlowStatements;
    const periods = cfstmts.map((s) => s.periodLabel);

    const cfHead = [['Tableau des Flux de Trésorerie (En Millions USD)', ...periods]];
    const cfBody = [
      ['Résultat Net Consolidé', ...cfstmts.map((s) => formatMillion(s.netIncome))],
      ['Amortissements & Dépréciations', ...cfstmts.map((s) => formatMillion(s.depreciationAmortization))],
      ['Rémunérations en Actions (SBC)', ...cfstmts.map((s) => formatMillion(s.stockBasedCompensation))],
      ['Variation du BFR (Change in Working Cap)', ...cfstmts.map((s) => formatMillion(s.changeInWorkingCapital))],
      ['FLUX OPÉRATIONNEL BRUT (OPERATING CASH FLOW)', ...cfstmts.map((s) => formatMillion(s.operatingCashFlow))],
      ['Dépenses d’Investissement (CapEx PP&E)', ...cfstmts.map((s) => formatMillion(s.capitalExpenditures))],
      ['Acquisitions d’Entreprises Nettes', ...cfstmts.map((s) => formatMillion(s.acquisitionsNet))],
      ['FLUX D’INVESTISSEMENT (INVESTING CASH FLOW)', ...cfstmts.map((s) => formatMillion(s.investingCashFlow))],
      ['Dividendes Versés aux Actionnaires', ...cfstmts.map((s) => formatMillion(s.dividendsPaid))],
      ['Rachat d’Actions Propres (Share Repurchase)', ...cfstmts.map((s) => formatMillion(s.commonStockRepurchase))],
      ['Émission / (Remboursement) de Dette Net', ...cfstmts.map((s) => {
        const iss = s.debtIssuance || 0;
        const rep = s.debtRepayment || 0;
        return formatMillion(iss - rep);
      })],
      ['FLUX DE FINANCEMENT (FINANCING CASH FLOW)', ...cfstmts.map((s) => formatMillion(s.financingCashFlow))],
      ['VARIATION NETTE DE TRÉSORERIE', ...cfstmts.map((s) => formatMillion(s.netChangeInCash))],
      ['FREE CASH FLOW DISPONIBLE (OCF - CAPEX)', ...cfstmts.map((s) => formatMillion(s.freeCashFlow))],
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...C_NAVY);
    doc.text('TABLEAU DE FLUX DE TRÉSORERIE (CASH FLOW STATEMENT)', margin, curY);

    curY += 2;

    autoTable(doc, {
      startY: curY,
      margin: { left: margin, right: margin },
      head: cfHead,
      body: cfBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.6,
        textColor: [30, 41, 59],
        lineColor: C_BORDER,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: C_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'right',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowText = String((data.row.raw as any)?.[0] || '');
          if (rowText.includes('FLUX OPÉRATIONNEL') || rowText.includes('FREE CASH FLOW')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [236, 253, 245];
            if (data.column.index > 0) {
              data.cell.styles.textColor = C_EMERALD;
            }
          }
          if (data.column.index > 0) {
            data.cell.styles.halign = 'right';
          }
        }
      },
    });
  }

  // ── 6. GRILLE COMPLÈTE DES RATIOS FINANCIERS ───────────────────────────────
  doc.addPage();
  curY = margin + 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C_NAVY);
  doc.text('MATRICE DÉTAILLÉE DES RATIOS FONDAMENTAUX', margin, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('Évaluation mathématique avec benchmarks et formules institutionnelles', margin + 85, curY);

  curY += 2;

  const ratios = overview.ratios;
  if (ratios) {
    const allRatiosList: { cat: string; items: FinancialRatioItem[] }[] = [
      { cat: '1. VALORISATION BOURSIÈRE', items: ratios.valuationRatios || [] },
      { cat: '2. RENTABILITÉ & MARGES', items: ratios.profitabilityRatios || [] },
      { cat: '3. SANTÉ FINANCIÈRE & SOLVABILITÉ', items: ratios.healthRatios || [] },
      { cat: '4. DYNAMIQUE DE CROISSANCE', items: ratios.growthRatios || [] },
    ];

    const rHead = [['Catégorie / Ratio', 'Valeur', 'Repère Marché', 'Formule Comptable', 'Interprétation Institutionnelle']];
    const rBody: any[] = [];

    allRatiosList.forEach((group) => {
      rBody.push([{ content: group.cat, colSpan: 5, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: C_NAVY } }]);
      group.items.forEach((r) => {
        rBody.push([
          r.label,
          r.formattedValue,
          r.benchmarkText || 'N/A',
          r.formula,
          r.tooltip,
        ]);
      });
    });

    autoTable(doc, {
      startY: curY,
      margin: { left: margin, right: margin },
      head: rHead,
      body: rBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
        lineColor: C_BORDER,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: C_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 20, textColor: C_BLUE },
        2: { halign: 'center', cellWidth: 26, textColor: C_MUTED },
        3: { fontStyle: 'italic', cellWidth: 38, textColor: [71, 85, 105] },
        4: { cellWidth: 56, textColor: [51, 65, 85] },
      },
    });
  }

  // ── 7. PIED DE PAGE & NUMÉROTATION UNIVERSELLE (Toutes les pages) ───────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Header récurrent (pour les pages > 1)
    if (i > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C_MUTED);
      doc.text(`MARKET SIMULATOR — ANALYSE FONDAMENTALE : ${companyTitle}`, margin, margin + 4);

      doc.setFont('helvetica', 'normal');
      doc.text(`SEC Form 10-K/10-Q & Finnhub Quotes`, pageWidth - margin, margin + 4, { align: 'right' });

      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.2);
      doc.line(margin, margin + 6, pageWidth - margin, margin + 6);
    }

    // Footer
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - margin - 5, pageWidth - margin, pageHeight - margin - 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.text(`Rapport certifié SEC EDGAR & Finnhub — Généré le ${nowStr}`, margin, pageHeight - margin - 1.5);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - margin - 1.5, { align: 'right' });
  }

  const filename = `${symbol}_Rapport_Analyse_Fondamentale_${frequency}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Génère un rapport PDF haute fidélité pour le comparateur multi-entreprises (2 à 5 sociétés).
 */
export function generateComparisonPdf(comparison: CompanyComparison) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const syms = comparison.symbols;
  const nowStr = new Date().toLocaleString('fr-FR');

  let curY = margin + 10;

  // Header
  doc.setFillColor(...C_DARK);
  doc.roundedRect(margin, curY, contentWidth, 24, 2.5, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('MATRICE COMPARATIVE MULTI-ENTREPRISES (PEER BENCHMARK)', margin + 6, curY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Entreprises analysées : ${syms.join(', ')}  |  Source : Finnhub Stock Metrics & SEC Filings  |  Généré le ${nowStr}`, margin + 6, curY + 18);

  curY += 29;

  // Table
  const head = [['Indicateur Financier', 'Catégorie', 'Unité', ...syms, 'Meilleure Performance (Best)']];
  const body = comparison.comparisonRows.map((row) => {
    const vals = syms.map((s) => row.valuesBySymbol[s] || 'N/A');
    const best = row.bestSymbol ? `${row.bestSymbol} (${row.valuesBySymbol[row.bestSymbol] || ''})` : '—';
    return [row.label, row.category, row.unit, ...vals, best];
  });

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: head,
    body: body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: C_BORDER,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: C_DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 55 },
      1: { halign: 'center', textColor: C_MUTED, cellWidth: 28 },
      2: { halign: 'center', textColor: C_MUTED, cellWidth: 16 },
    },
    didParseCell: (data) => {
      // Align company values to right
      if (data.section === 'body') {
        const colIdx = data.column.index;
        if (colIdx >= 3 && colIdx < 3 + syms.length) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        }
        // Best Performer column
        if (colIdx === 3 + syms.length) {
          data.cell.styles.halign = 'center';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = C_EMERALD;
          data.cell.styles.fillColor = [240, 253, 244];
        }
      }
    },
  });

  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - margin - 4, pageWidth - margin, pageHeight - margin - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`Market Simulator Institutional Terminal — Rapport Comparatif`, margin, pageHeight - margin - 1);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - margin - 1, { align: 'right' });
  }

  const filename = `Comparaison_${syms.join('_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
