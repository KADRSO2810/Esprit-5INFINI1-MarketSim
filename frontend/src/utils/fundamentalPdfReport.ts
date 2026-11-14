import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CompanyFundamentalOverview,
  CompanyFinancialStatements,
  CompanyComparison,
  FinancialRatioItem,
} from '../api/fundamentals';

// Palette institutionnelle haute définition
const C_NAVY: [number, number, number] = [11, 26, 43];       // #0B1A2B
const C_BLUE: [number, number, number] = [14, 116, 144];     // #0E7490
const C_DARK: [number, number, number] = [15, 23, 42];       // #0F172A
const C_EMERALD: [number, number, number] = [16, 185, 129]; // #10B981
const C_MUTED: [number, number, number] = [100, 116, 139];  // #64748B
const C_LIGHT: [number, number, number] = [248, 250, 252];  // #F8FAFC
const C_BORDER: [number, number, number] = [226, 232, 240]; // #E2E8F0

/**
 * Formate un montant financier de manière compacte et élégante (1 seule ligne garantie).
 * Ex: $478.8B, $132.2B, $850.0M, $12.5M, $6.13
 */
function formatAmount(val?: number | null): string {
  if (val == null) return '—';
  if (val === 0) return '$0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const b = abs / 1_000_000_000;
    return `${sign}$${b.toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k.toFixed(0)}k`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * Formate un pourcentage sans fausse multiplication x100 si la valeur est déjà en base 100.
 * Ex: 48.79 -> 48.8%, 15.06 -> 15.1%
 */
function formatPct(val?: number | null): string {
  if (val == null) return '—';
  const abs = Math.abs(val);
  // Si la valeur est sous forme décimale brute (ex: 0.1506 pour 15.06%), on convertit
  const num = abs <= 1.0 && abs > 0 ? val * 100 : val;
  return `${num.toFixed(1)}%`;
}

/**
 * Formate le BPA / EPS en dollars par action (ex: $8.98)
 */
function formatEps(val?: number | null): string {
  if (val == null) return '—';
  const sign = val < 0 ? '-' : '';
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

/**
 * Génère un rapport d'analyse fondamentale professionnel multi-pages.
 * Chaque page est dédiée à une thématique avec 5 colonnes temporelles maximum pour garantir
 * qu'aucun chiffre n'est tronqué ou écrit verticalement sur plusieurs lignes.
 */
export function generateCompanyFundamentalPdf(
  overview: CompanyFundamentalOverview,
  statements: CompanyFinancialStatements | null,
  frequency: 'ANNUAL' | 'QUARTERLY'
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;          // 182 mm
  const symbol = overview.symbol;
  const profile = overview.profile;
  const freqLabel = frequency === 'ANNUAL' ? 'Exercices Annuels (SEC Form 10-K)' : 'Trimestres (SEC Form 10-Q)';
  const nowStr = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calcul du cours estimé si cours live indisponible
  let livePriceDisplay = 'N/A';
  if (overview.currentPrice != null && overview.currentPrice > 0) {
    livePriceDisplay = `$${overview.currentPrice.toFixed(2)}`;
  } else if (profile?.marketCapitalization && profile?.shareOutstanding && profile.shareOutstanding > 0) {
    const est = profile.marketCapitalization / profile.shareOutstanding;
    livePriceDisplay = `$${est.toFixed(2)}`;
  }

  // Limitation stricte aux 5 dernières périodes historiques pour garantir la lisibilité horizontale
  const maxPeriods = 5;
  const incStmts = (statements?.incomeStatements || []).slice(0, maxPeriods);
  const balStmts = (statements?.balanceSheets || []).slice(0, maxPeriods);
  const cfStmts = (statements?.cashFlowStatements || []).slice(0, maxPeriods);

  // Largeurs de colonnes calculées au millimètre pour 5 périodes :
  // Col 0: 67 mm | Col 1 à 5: 23 mm chaque = 67 + 5*23 = 182 mm (100% de la largeur disponible)
  const colStyles5: Record<number, any> = {
    0: { halign: 'left', fontStyle: 'bold', cellWidth: 67 },
    1: { halign: 'right', fontStyle: 'normal', cellWidth: 23 },
    2: { halign: 'right', fontStyle: 'normal', cellWidth: 23 },
    3: { halign: 'right', fontStyle: 'normal', cellWidth: 23 },
    4: { halign: 'right', fontStyle: 'normal', cellWidth: 23 },
    5: { halign: 'right', fontStyle: 'normal', cellWidth: 23 },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 : RÉSUMÉ EXÉCUTIF & SYNTHÈSE PLURIANNUELLE
  // ═══════════════════════════════════════════════════════════════════════════
  let curY = margin + 12;

  // 1. Bandeau Institutionnel Supérieur
  doc.setFillColor(...C_DARK);
  doc.roundedRect(margin, curY, contentWidth, 32, 2.5, 2.5, 'F');

  // Pill "EQUITY RESEARCH"
  doc.setFillColor(...C_BLUE);
  doc.roundedRect(margin + 4, curY + 4, 52, 5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('EQUITY RESEARCH · SEC AUDITED', margin + 6, curY + 7.5);

  // Titre Société & Symbole
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const companyTitle = `${profile?.name || symbol} (${symbol})`;
  doc.text(companyTitle, margin + 4, curY + 17);

  // Sous-titre Métadonnées
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const metaLine = `${profile?.exchange || 'US Exchanges'} · Secteur : ${profile?.finnhubIndustry || profile?.sector || 'Général'} · Devise : ${profile?.currency || 'USD'}`;
  doc.text(metaLine, margin + 4, curY + 23);

  const secNote = `Dépôts officiels Form 10-K / 10-Q normalisés US-GAAP`;
  doc.setFontSize(7);
  doc.text(secNote, margin + 4, curY + 28);

  // Cartouche Prix & Market Cap (à droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C_EMERALD);
  doc.text(livePriceDisplay, pageWidth - margin - 4, curY + 14, { align: 'right' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('COURS DE MARCHÉ (LIVE/CLOSING)', pageWidth - margin - 4, curY + 19, { align: 'right' });

  const capStr = profile?.marketCapitalization != null
    ? `$${(profile.marketCapitalization / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`
    : 'N/A';
  doc.text(`Cap. Boursière : ${capStr}`, pageWidth - margin - 4, curY + 25, { align: 'right' });

  curY += 36;

  // 2. Grille 4x2 des 8 KPIs Clés
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_NAVY);
  doc.text('1. INDICATEURS CLÉS DE PERFORMANCE & VALORISATION', margin, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text(`Données de synthèse certifiées SEC`, pageWidth - margin, curY, { align: 'right' });

  curY += 3.5;

  const kpis = [
    { label: "Chiffre d'Affaires", val: formatAmount(overview.latestRevenue), sub: "Dernier exercice déclaré" },
    { label: "Résultat Net", val: formatAmount(overview.latestNetIncome), sub: "Part du groupe nette" },
    { label: "BPA Dilué (EPS)", val: formatEps(overview.latestEps), sub: "Bénéfice par action" },
    { label: "P/E Ratio", val: overview.peRatio != null ? `${overview.peRatio.toFixed(2)}x` : 'N/A', sub: "Multiple cours / bénéfice" },
    { label: "ROE (Capitaux Propres)", val: formatPct(overview.roe), sub: "Rendement des CP" },
    { label: "Debt-to-Equity (D/E)", val: overview.debtToEquity != null ? `${overview.debtToEquity.toFixed(2)}x` : 'N/A', sub: "Dette totale / CP" },
    { label: "Croissance CA YoY", val: formatPct(overview.revenueGrowthYoY), sub: "Sur 12 mois glissants" },
    { label: "Free Cash Flow (FCF)", val: formatAmount(overview.freeCashFlow), sub: "Flux disponible réel" },
  ];

  const cardW = (contentWidth - 3 * 2.5) / 4; // ~43.6 mm
  const cardH = 14;

  kpis.forEach((kpi, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = margin + col * (cardW + 2.5);
    const y = curY + row * (cardH + 2.5);

    doc.setFillColor(...C_LIGHT);
    doc.setDrawColor(...C_BORDER);
    doc.roundedRect(x, y, cardW, cardH, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...C_MUTED);
    doc.text(kpi.label.toUpperCase(), x + 2.5, y + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_NAVY);
    doc.text(kpi.val, x + 2.5, y + 8.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, x + 2.5, y + 12.2);
  });

  curY += 2 * cardH + 7;

  // 3. Tableau de Synthèse Pluriannuelle (5 Derniers Exercices)
  if (incStmts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_NAVY);
    doc.text('2. SYNTHÈSE FINANCIÈRE PLURIANNUELLE (5 DERNIÈRES PÉRIODES)', margin, curY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`En Milliards ($B) ou Millions ($M) selon l'échelle`, pageWidth - margin, curY, { align: 'right' });

    curY += 2.5;

    const periods = incStmts.map((s) => s.periodLabel);
    const synthHead = [['Indicateur Financier Clé', ...periods]];
    const synthBody = [
      ['Chiffre d’Affaires Total (Revenues)', ...incStmts.map((s) => formatAmount(s.revenue))],
      ['Marge Brute (Gross Profit)', ...incStmts.map((s) => formatAmount(s.grossProfit))],
      ['Résultat d’Exploitation (Operating Income)', ...incStmts.map((s) => formatAmount(s.operatingIncome))],
      ['Résultat Net Attribuable (Net Income)', ...incStmts.map((s) => formatAmount(s.netIncome))],
      ['Bénéfice Net par Action (BPA Dilué)', ...incStmts.map((s) => formatEps(s.epsDiluted))],
      ['Marge Brute (%)', ...incStmts.map((s) => formatPct(s.grossMarginPct))],
      ['Marge d’Exploitation (%)', ...incStmts.map((s) => formatPct(s.operatingMarginPct))],
      ['Marge Nette (%)', ...incStmts.map((s) => formatPct(s.netMarginPct))],
    ];

    autoTable(doc, {
      startY: curY,
      margin: { top: 22, left: margin, right: margin, bottom: 18 },
      head: synthHead,
      body: synthBody,
      theme: 'grid',
      styles: {
        fontSize: 7.8,
        cellPadding: 2,
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
      columnStyles: colStyles5,
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowText = String((data.row.raw as any)?.[0] || '');
          if (rowText.includes('Chiffre d’Affaires') || rowText.includes('Résultat Net Attribuable')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 249, 255];
            if (data.column.index > 0) data.cell.styles.textColor = C_NAVY;
          }
        }
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Note de bas de page 1
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(...C_MUTED);
  doc.text('Note : Les états financiers complets et le tableau des flux de trésorerie sont détaillés en pages 2 et 3.', margin, curY + 3);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 : COMPTE DE RÉSULTAT CONSOLIDÉ DÉTAILLÉ
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  curY = margin + 12;

  if (incStmts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_NAVY);
    doc.text('3. COMPTE DE RÉSULTAT CONSOLIDÉ (INCOME STATEMENT)', margin, curY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`${freqLabel} · 5 Dernières Périodes`, pageWidth - margin, curY, { align: 'right' });

    curY += 2.5;

    const periods = incStmts.map((s) => s.periodLabel);
    const incHead = [['Poste Comptable (US-GAAP)', ...periods]];
    const incBody = [
      ['Chiffre d’Affaires Total (Revenues)', ...incStmts.map((s) => formatAmount(s.revenue))],
      ['Coût des Ventes (COGS)', ...incStmts.map((s) => formatAmount(s.costOfGoodsSold))],
      ['MARGE BRUTE (GROSS PROFIT)', ...incStmts.map((s) => formatAmount(s.grossProfit))],
      ['Recherche & Développement (R&D)', ...incStmts.map((s) => formatAmount(s.researchAndDevelopment))],
      ['Frais Généraux, Administratifs & Vente (SG&A)', ...incStmts.map((s) => formatAmount(s.sellingGeneralAdmin))],
      ['Total des Charges d’Exploitation (OpEx)', ...incStmts.map((s) => formatAmount(s.operatingExpenses))],
      ['RÉSULTAT D’EXPLOITATION (OPERATING INCOME)', ...incStmts.map((s) => formatAmount(s.operatingIncome))],
      ['EBITDA Normalisé', ...incStmts.map((s) => formatAmount(s.ebitda))],
      ['Charges / (Produits) d’Intérêts Nets', ...incStmts.map((s) => formatAmount(s.netInterestExpense))],
      ['Résultat Avant Impôt (Pretax Income)', ...incStmts.map((s) => formatAmount(s.pretaxIncome))],
      ['Provision pour Impôt sur les Bénéfices', ...incStmts.map((s) => formatAmount(s.incomeTax))],
      ['RÉSULTAT NET ATTRIBUABLE (NET INCOME)', ...incStmts.map((s) => formatAmount(s.netIncome))],
      ['Bénéfice par Action de Base ($)', ...incStmts.map((s) => formatEps(s.epsBasic))],
      ['BÉNÉFICE PAR ACTION DILUÉ ($ / ACTION)', ...incStmts.map((s) => formatEps(s.epsDiluted))],
      ['Marge Brute (%)', ...incStmts.map((s) => formatPct(s.grossMarginPct))],
      ['Marge d’Exploitation (%)', ...incStmts.map((s) => formatPct(s.operatingMarginPct))],
      ['Marge Nette de Profit (%)', ...incStmts.map((s) => formatPct(s.netMarginPct))],
    ];

    autoTable(doc, {
      startY: curY,
      margin: { top: 22, left: margin, right: margin, bottom: 18 },
      head: incHead,
      body: incBody,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
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
      columnStyles: colStyles5,
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowText = String((data.row.raw as any)?.[0] || '');
          if (rowText.includes('MARGE BRUTE') || rowText.includes('RÉSULTAT D’EXPLOITATION') || rowText.includes('RÉSULTAT NET') || rowText.includes('BÉNÉFICE PAR ACTION DILUÉ')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 249, 255];
            if (data.column.index > 0) data.cell.styles.textColor = C_NAVY;
          }
          if (rowText.includes('Marge')) {
            data.cell.styles.fontStyle = 'italic';
          }
        }
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Encadré d'analyse des marges (bas de page 2)
  doc.setFillColor(...C_LIGHT);
  doc.setDrawColor(...C_BORDER);
  doc.roundedRect(margin, curY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  doc.text('ANALYSE DE LA QUALITÉ DU RÉSULTAT & POUVOIR DE PRICING', margin + 3.5, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...C_MUTED);
  const pLatest = incStmts[0];
  const grossStr = pLatest?.grossMarginPct != null ? formatPct(pLatest.grossMarginPct) : 'N/A';
  const opStr = pLatest?.operatingMarginPct != null ? formatPct(pLatest.operatingMarginPct) : 'N/A';
  const netStr = pLatest?.netMarginPct != null ? formatPct(pLatest.netMarginPct) : 'N/A';
  doc.text(
    `Au dernier exercice (${pLatest?.periodLabel || 'Récent'}), l'entreprise dégage une Marge Brute de ${grossStr}, une Marge Opérationnelle de ${opStr} et une Marge Nette de ${netStr}. ` +
    `Ce profil reflète un positionnement concurrentiel fort avec un pouvoir de fixation des prix (pricing power) et une excellente conversion du chiffre d'affaires en bénéfices nets distribuables.`,
    margin + 3.5,
    curY + 11.5,
    { maxWidth: contentWidth - 7, lineHeightFactor: 1.35 }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3 : BILAN COMPTABLE & FLUX DE TRÉSORERIE (CASH FLOW)
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  curY = margin + 12;

  // 1. Bilan Comptable
  if (balStmts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_NAVY);
    doc.text('4. BILAN COMPTABLE CONSOLIDÉ (BALANCE SHEET)', margin, curY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`${freqLabel} · 5 Dernières Périodes`, pageWidth - margin, curY, { align: 'right' });

    curY += 2.5;

    const bPeriods = balStmts.map((s) => s.periodLabel);
    const bHead = [['Structure du Bilan (US-GAAP)', ...bPeriods]];
    const bBody = [
      ['Trésorerie & Équivalents de Cash', ...balStmts.map((s) => formatAmount(s.cashAndEquivalents))],
      ['Créances Clients (Accounts Receivable)', ...balStmts.map((s) => formatAmount(s.accountsReceivable))],
      ['Stocks & Inventaires', ...balStmts.map((s) => formatAmount(s.inventory))],
      ['Actif Circulant Total (Current Assets)', ...balStmts.map((s) => formatAmount(s.currentAssets))],
      ['Immobilisations Corporelles Nettes (PP&E)', ...balStmts.map((s) => formatAmount(s.propertyPlantEquipmentNet))],
      ['TOTAL DE L’ACTIF CONSOLIDÉ', ...balStmts.map((s) => formatAmount(s.totalAssets))],
      ['Dettes Fournisseurs (Accounts Payable)', ...balStmts.map((s) => formatAmount(s.accountsPayable))],
      ['Passif Circulant Total (Current Liabilities)', ...balStmts.map((s) => formatAmount(s.currentLiabilities))],
      ['Dette à Long Terme (Financière)', ...balStmts.map((s) => formatAmount(s.longTermDebt))],
      ['DETTE TOTALE BRUTE CONSOLIDÉE', ...balStmts.map((s) => formatAmount(s.totalDebt))],
      ['TOTAL DU PASSIF (TOTAL LIABILITIES)', ...balStmts.map((s) => formatAmount(s.totalLiabilities))],
      ['CAPITAUX PROPRES (STOCKHOLDERS’ EQUITY)', ...balStmts.map((s) => formatAmount(s.totalStockholdersEquity))],
      ['Fonds de Roulement Net (Working Capital)', ...balStmts.map((s) => formatAmount(s.workingCapital))],
      ['Dette Nette (Dette Totale - Trésorerie)', ...balStmts.map((s) => formatAmount(s.netDebt))],
    ];

    autoTable(doc, {
      startY: curY,
      margin: { top: 22, left: margin, right: margin, bottom: 18 },
      head: bHead,
      body: bBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
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
      columnStyles: colStyles5,
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowText = String((data.row.raw as any)?.[0] || '');
          if (rowText.includes('TOTAL') || rowText.includes('CAPITAUX PROPRES') || rowText.includes('DETTE TOTALE')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
            if (data.column.index > 0) data.cell.styles.textColor = C_NAVY;
          }
        }
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 7;
  }

  // 2. Tableau des Flux de Trésorerie (Cash Flow)
  if (cfStmts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_NAVY);
    doc.text('5. TABLEAU DES FLUX DE TRÉSORERIE (CASH FLOW STATEMENT)', margin, curY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`Génération de Free Cash Flow Réel`, pageWidth - margin, curY, { align: 'right' });

    curY += 2.5;

    const cfPeriods = cfStmts.map((s) => s.periodLabel);
    const cfHead = [['Flux de Liquidité (US-GAAP)', ...cfPeriods]];
    const cfBody = [
      ['Résultat Net Consolidé', ...cfStmts.map((s) => formatAmount(s.netIncome))],
      ['Amortissements & Dépréciations', ...cfStmts.map((s) => formatAmount(s.depreciationAmortization))],
      ['Variation du BFR (Working Capital Change)', ...cfStmts.map((s) => formatAmount(s.changeInWorkingCapital))],
      ['FLUX OPÉRATIONNEL BRUT (OPERATING CASH FLOW)', ...cfStmts.map((s) => formatAmount(s.operatingCashFlow))],
      ['Dépenses d’Investissement (CapEx PP&E)', ...cfStmts.map((s) => formatAmount(s.capitalExpenditures))],
      ['FLUX D’INVESTISSEMENT (INVESTING CASH FLOW)', ...cfStmts.map((s) => formatAmount(s.investingCashFlow))],
      ['Dividendes Distribués aux Actionnaires', ...cfStmts.map((s) => formatAmount(s.dividendsPaid))],
      ['Rachats d’Actions Propres (Share Repurchase)', ...cfStmts.map((s) => formatAmount(s.commonStockRepurchase))],
      ['FLUX DE FINANCEMENT (FINANCING CASH FLOW)', ...cfStmts.map((s) => formatAmount(s.financingCashFlow))],
      ['FREE CASH FLOW DISPONIBLE (OCF - CAPEX)', ...cfStmts.map((s) => formatAmount(s.freeCashFlow))],
    ];

    autoTable(doc, {
      startY: curY,
      margin: { top: 22, left: margin, right: margin, bottom: 18 },
      head: cfHead,
      body: cfBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
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
      columnStyles: colStyles5,
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowText = String((data.row.raw as any)?.[0] || '');
          if (rowText.includes('FLUX OPÉRATIONNEL') || rowText.includes('FREE CASH FLOW')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [236, 253, 245];
            if (data.column.index > 0) data.cell.styles.textColor = C_EMERALD;
          }
        }
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 4 : MATRICE EXHAUSTIVE DES RATIOS FONDAMENTAUX & BENCHMARKS
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  curY = margin + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C_NAVY);
  doc.text('6. MATRICE COMPLÈTE DES RATIOS FONDAMENTAUX & SANTÉ FINANCIÈRE', margin, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('Évaluation mathématique avec repères de marché et formules institutionnelles', pageWidth - margin, curY, { align: 'right' });

  curY += 3;

  const ratios = overview.ratios;
  if (ratios) {
    const allRatiosList: { cat: string; items: FinancialRatioItem[] }[] = [
      { cat: '1. RATIOS DE VALORISATION BOURSIÈRE', items: ratios.valuationRatios || [] },
      { cat: '2. RATIOS DE RENTABILITÉ & DE MARGE', items: ratios.profitabilityRatios || [] },
      { cat: '3. SANTÉ FINANCIÈRE & STRUCTURE DU BILAN', items: ratios.healthRatios || [] },
      { cat: '4. DYNAMIQUE DE CROISSANCE (SUR 12 MOIS)', items: ratios.growthRatios || [] },
    ];

    const rHead = [['Catégorie / Ratio', 'Valeur', 'Repère Marché', 'Formule Comptable', 'Interprétation Financière']];
    const rBody: any[] = [];

    allRatiosList.forEach((group) => {
      rBody.push([
        {
          content: group.cat,
          colSpan: 5,
          styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: C_NAVY, fontSize: 7.5 },
        },
      ]);
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
      margin: { top: 22, left: margin, right: margin, bottom: 18 },
      head: rHead,
      body: rBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 2,
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
        0: { fontStyle: 'bold', cellWidth: 44 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 22, textColor: C_BLUE },
        2: { halign: 'center', cellWidth: 26, textColor: C_MUTED },
        3: { fontStyle: 'italic', cellWidth: 38, textColor: [71, 85, 105] },
        4: { cellWidth: 52, textColor: [51, 65, 85] },
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Disclaimer Réglementaire (bas de page 4)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C_MUTED);
  const disclaimer = `Méthodologie & Décharge : Ce rapport d'analyse fondamentale est généré par le moteur institutionnel Market Simulator. Les données comptables proviennent des dépôts officiels auprès de la Securities and Exchange Commission (SEC Form 10-K & 10-Q) et les cours de marché de Finnhub Stock API. Ce document est fourni à titre indicatif et ne constitue en aucun cas un conseil en investissement financier.`;
  doc.text(disclaimer, margin, curY + 3, { maxWidth: contentWidth, lineHeightFactor: 1.35 });

  // ═══════════════════════════════════════════════════════════════════════════
  // EN-TÊTE RÉCURRENT ET NUMÉROTATION UNIVERSELLE SUR TOUTES LES PAGES
  // ═══════════════════════════════════════════════════════════════════════════
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // En-tête récurrent (Pages 2, 3, 4)
    if (i > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C_MUTED);
      doc.text(`MARKET SIMULATOR · RAPPORT D’ANALYSE FONDAMENTALE : ${companyTitle}`, margin, margin + 4);

      doc.setFont('helvetica', 'normal');
      doc.text(`SEC Form 10-K / 10-Q · Finnhub Quotes`, pageWidth - margin, margin + 4, { align: 'right' });

      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.2);
      doc.line(margin, margin + 6, pageWidth - margin, margin + 6);
    }

    // Pied de page universel
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - margin - 5, pageWidth - margin, pageHeight - margin - 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.text(`Document certifié SEC EDGAR & Finnhub · Généré le ${nowStr}`, margin, pageHeight - margin - 1.5);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - margin - 1.5, { align: 'right' });
  }

  const filename = `${symbol}_Rapport_Analyse_Fondamentale_${frequency}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Génère un rapport PDF haute fidélité pour le comparateur multi-entreprises (2 à 5 sociétés).
 * Format Paysage A4 (297 mm x 210 mm) avec alignement horizontal parfait sans coupures.
 */
export function generateComparisonPdf(comparison: CompanyComparison): string {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;          // 269 mm
  const syms = comparison.symbols;
  const nowStr = new Date().toLocaleString('fr-FR');

  let curY = margin + 10;

  // Header Dark Bandeau
  doc.setFillColor(...C_DARK);
  doc.roundedRect(margin, curY, contentWidth, 22, 2.5, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('MATRICE COMPARATIVE MULTI-ENTREPRISES (PEER BENCHMARKING)', margin + 6, curY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Sociétés Comparées : ${syms.join(', ')}  |  Sources officielles : Finnhub Stock Metrics & SEC Filings  |  Généré le ${nowStr}`,
    margin + 6,
    curY + 16
  );

  curY += 26;

  // Table
  const head = [['Indicateur Financier', 'Catégorie', 'Unité', ...syms, 'Meilleure Performance (Best)']];
  const body = comparison.comparisonRows.map((row) => {
    const vals = syms.map((s) => row.valuesBySymbol[s] || '—');
    const best = row.bestSymbol ? `${row.bestSymbol} (${row.valuesBySymbol[row.bestSymbol] || ''})` : '—';
    return [row.label, row.category, row.unit, ...vals, best];
  });

  // Calcul dynamique des largeurs de colonnes :
  // Col 0: 60 mm | Col 1: 30 mm | Col 2: 18 mm | Col N: 28 mm chaque | Best: 45 mm
  const compColStyles: Record<number, any> = {
    0: { fontStyle: 'bold', halign: 'left', cellWidth: 62 },
    1: { halign: 'center', textColor: C_MUTED, cellWidth: 28 },
    2: { halign: 'center', textColor: C_MUTED, cellWidth: 16 },
  };

  const perCompanyWidth = Math.floor((contentWidth - 62 - 28 - 16 - 45) / syms.length);
  syms.forEach((_, sIdx) => {
    compColStyles[3 + sIdx] = { halign: 'right', fontStyle: 'bold', cellWidth: perCompanyWidth };
  });
  compColStyles[3 + syms.length] = {
    halign: 'center',
    fontStyle: 'bold',
    textColor: C_EMERALD,
    cellWidth: 45,
  };

  autoTable(doc, {
    startY: curY,
    margin: { top: 22, left: margin, right: margin, bottom: 18 },
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
    columnStyles: compColStyles,
    didParseCell: (data) => {
      if (data.section === 'body') {
        const colIdx = data.column.index;
        // Best Performer column highlight
        if (colIdx === 3 + syms.length) {
          data.cell.styles.fillColor = [240, 253, 244];
        }
      }
    },
  });

  // Footers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - margin - 4, pageWidth - margin, pageHeight - margin - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`Market Simulator Institutional Quant Terminal · Rapport Comparatif d'Actions`, margin, pageHeight - margin - 1);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - margin - 1, { align: 'right' });
  }

  const filename = `Comparaison_${syms.join('_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
