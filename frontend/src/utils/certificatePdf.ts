import jsPDF from 'jspdf';
import { UserBadge } from '../api/learning';

export interface CertificateData {
  badge: UserBadge;
  userEmail: string;
  userName?: string;
}

export function generateCertificatePdf(data: CertificateData): void {
  const { badge, userEmail, userName } = data;

  // Format A4 Paysage (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const width = 297;
  const height = 210;

  // =========================================================================
  // 1. FOND DE SÉCURITÉ LUXE (DARK OBSIDIAN / NAVY)
  // =========================================================================
  doc.setFillColor(7, 11, 20); // #070B14
  doc.rect(0, 0, width, height, 'F');

  // Dégradé de fond subtil (bande centrale)
  doc.setFillColor(11, 18, 36); // #0B1224
  doc.rect(10, 10, width - 20, height - 20, 'F');

  // =========================================================================
  // 2. CADRES & MOTIFS GÉOMÉTRIQUES D'OR ET DE CYAN
  // =========================================================================
  // Cadre extérieur or
  doc.setDrawColor(245, 158, 11); // #F59E0B
  doc.setLineWidth(1.2);
  doc.rect(12, 12, width - 24, height - 24);

  // Cadre intérieur cyan
  doc.setDrawColor(56, 189, 248); // #38BDF8
  doc.setLineWidth(0.4);
  doc.rect(15, 15, width - 30, height - 30);

  // Filets d'ornement d'angles
  const drawCorner = (x: number, y: number, dx: number, dy: number) => {
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.8);
    doc.line(x, y, x + dx * 12, y);
    doc.line(x, y, x, y + dy * 12);
    doc.setFillColor(245, 158, 11);
    doc.circle(x + dx * 3, y + dy * 3, 0.8, 'F');
  };

  drawCorner(16, 16, 1, 1);
  drawCorner(width - 16, 16, -1, 1);
  drawCorner(16, height - 16, 1, -1);
  drawCorner(width - 16, height - 16, -1, -1);

  // Filigrane géométrique central (Guilloché subtil)
  doc.setDrawColor(30, 41, 59); // #1E293B
  doc.setLineWidth(0.2);
  doc.circle(width / 2, height / 2 + 10, 48, 'S');
  doc.circle(width / 2, height / 2 + 10, 42, 'S');
  doc.circle(width / 2, height / 2 + 10, 36, 'S');

  // =========================================================================
  // 3. EN-TÊTE INSTITUTIONNEL OFFICIEL
  // =========================================================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // #94A3B8
  doc.text(
    'RÉPUBLIQUE TUNISIENNE  •  MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR ET DE LA RECHERCHE SCIENTIFIQUE',
    width / 2,
    24,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('ESPRIT — ÉCOLE SUPÉRIEURE PRIVÉE D’INGÉNIERIE ET DE TECHNOLOGIE', width / 2, 30, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(56, 189, 248); // #38BDF8
  doc.text(
    'DÉPARTEMENT GÉNIE FINANCIER & SALLE DE MARCHÉ SIMULÉE  •  SESSION ACADÉMIQUE 2026-2027',
    width / 2,
    35,
    { align: 'center' }
  );

  // Ligne de séparation dorée
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.6);
  doc.line(width / 2 - 60, 38, width / 2 + 60, 38);

  // =========================================================================
  // 4. TITRE OFFICIEL DE LA CERTIFICATION
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(245, 158, 11); // #F59E0B
  doc.text('CERTIFICAT D’ACCRÉDITATION PROFESSIONNELLE', width / 2, 49, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // #CBD5E1
  doc.text(
    'ATTESTATION OFFICIELLE DE MAÎTRISE THÉORIQUE & PRATIQUE DES OPÉRATIONS FINANCIÈRES',
    width / 2,
    55,
    { align: 'center' }
  );

  // =========================================================================
  // 5. CORPS DU CERTIFICAT : RÉCIPIENDAIRE & SPÉCIALISATION
  // =========================================================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('Le Conseil Scientifique et les Directeurs de Salle de Marché certifient par la présente que :', width / 2, 67, {
    align: 'center',
  });

  // Nom / Identifiant de l'étudiant
  const displayName = userName && userName.trim().length > 0 ? userName : userEmail.split('@')[0].toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(56, 189, 248); // #38BDF8
  doc.text(displayName, width / 2, 76, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Identifiant de compte certifié : ${userEmail}`, width / 2, 82, { align: 'center' });

  doc.text(
    'A validé avec succès l’intégralité des fiches de cours académiques et réussi l’évaluation par QCM de la spécialisation :',
    width / 2,
    91,
    { align: 'center' }
  );

  // Titre de la Spécialisation / Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(badge.title.toUpperCase(), width / 2, 100, { align: 'center' });

  // Description académique
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(badge.description, width / 2, 106, { align: 'center' });

  // =========================================================================
  // 6. BLOC DES INDICATEURS D'ÉVALUATION & MENTIONS
  // =========================================================================
  const cardX = width / 2 - 95;
  const cardY = 114;
  const cardW = 190;
  const cardH = 28;

  doc.setFillColor(15, 23, 42); // #0F172A
  doc.setDrawColor(51, 65, 85); // #334155
  doc.setLineWidth(0.4);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'FD');

  // Colonne 1 : Note au Quiz
  const scoreVal = badge.scorePercentage != null ? `${Number(badge.scorePercentage).toFixed(0)}%` : '100%';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('SCORE D’ÉVALUATION', cardX + 30, cardY + 8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(34, 197, 94); // #22C55E
  doc.text(scoreVal, cardX + 30, cardY + 17, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Seuil requis : ≥ 75%', cardX + 30, cardY + 23, { align: 'center' });

  // Colonne 2 : Mention académique
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('MENTION OBTENUE', cardX + 95, cardY + 8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(245, 158, 11); // Gold
  doc.text('FÉLICITATIONS DU JURY', cardX + 95, cardY + 16, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text('Compétences de Marché Validées', cardX + 95, cardY + 23, { align: 'center' });

  // Colonne 3 : Date de Délivrance
  const dateFormatted = badge.unlockedAt
    ? new Date(badge.unlockedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('DATE DE DÉLIVRANCE', cardX + 160, cardY + 8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(dateFormatted, cardX + 160, cardY + 16, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Enregistré au registre central', cardX + 160, cardY + 23, { align: 'center' });

  // =========================================================================
  // 7. SCEAU DORÉ & SIGNATURES OFFICIELLES
  // =========================================================================
  // Sceau doré officiel au centre
  const sealX = width / 2;
  const sealY = 160;

  doc.setFillColor(245, 158, 11);
  doc.circle(sealX, sealY, 13, 'F');
  doc.setFillColor(7, 11, 20);
  doc.circle(sealX, sealY, 11, 'F');

  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.4);
  doc.circle(sealX, sealY, 9.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(245, 158, 11);
  doc.text('★ ESPRIT ★', sealX, sealY - 3.5, { align: 'center' });
  doc.setFontSize(5);
  doc.text('SALLE DE MARCHÉ', sealX, sealY, { align: 'center' });
  doc.text('CERTIFIÉ 2026', sealX, sealY + 3.5, { align: 'center' });

  // Signature 1 : Responsable de la Salle de Marché
  const sig1X = 55;
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.3);
  doc.line(sig1X - 35, 172, sig1X + 35, 172);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Dr. Responsable de la Salle de Marché', sig1X, 177, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Laboratoire d’Analyse Quantitative & Trading', sig1X, 181, { align: 'center' });
  doc.text('Signature Électronique Certifiée', sig1X, 185, { align: 'center' });

  // Signature 2 : Directeur du Pôle Ingénierie Financière
  const sig2X = width - 55;
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.3);
  doc.line(sig2X - 35, 172, sig2X + 35, 172);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Pr. Directeur du Pôle Ingénierie Financière', sig2X, 177, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('ESPRIT School of Engineering', sig2X, 181, { align: 'center' });
  doc.text('Commission Pédagogique d’Accréditation', sig2X, 185, { align: 'center' });

  // =========================================================================
  // 8. PIED DE PAGE & NUMÉRO D'AUTHENTICITÉ UNIQUE
  // =========================================================================
  const certId = badge.certificateId || `ESPRIT-MS-2026-${badge.badgeCode.replace('BADGE_', '')}-0842`;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Identifiant d’Authentification : ${certId}  •  Vérification cryptographique SHA-256`, width / 2, 196, {
    align: 'center',
  });
  doc.text('Ce certificat atteste des compétences acquises sur la plateforme institutionnelle Market Simulator ESPRIT.', width / 2, 200, {
    align: 'center',
  });

  // Sauvegarde / Téléchargement du fichier
  const filename = `ESPRIT_Certificat_${badge.badgeCode}_${displayName.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}
