package com.marketsimulator.dto.actuary;

public enum InsuranceProductType {
    AUTO("Assurance Automobile", "Véhicule personnel / Tiers & Tous Risques", 0.12, 3200.0),
    HEALTH("Complémentaire Santé", "Hospitalisation, Optique & Dentaire", 0.45, 850.0),
    HOME("Assurance Habitation (MRH)", "Résidence principale, Dégâts des eaux & Incendie", 0.08, 4800.0),
    LIFE("Prévoyance & Décès", "Capital décès & Rente invalidité", 0.015, 65000.0),
    COMMERCIAL("Responsabilité Civile Pro", "Entreprises, Dommages corporels & d'exploitation", 0.05, 12500.0);

    private final String label;
    private final String description;
    private final double baseFrequency;
    private final double baseSeverity;

    InsuranceProductType(String label, String description, double baseFrequency, double baseSeverity) {
        this.label = label;
        this.description = description;
        this.baseFrequency = baseFrequency;
        this.baseSeverity = baseSeverity;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }

    public double getBaseFrequency() {
        return baseFrequency;
    }

    public double getBaseSeverity() {
        return baseSeverity;
    }
}
