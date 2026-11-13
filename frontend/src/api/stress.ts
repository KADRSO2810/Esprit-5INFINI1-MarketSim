import api from './axios';

export type BankType = 'CONVENTIONAL' | 'NON_CONVENTIONAL';
export type StressRunStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

export interface Bank {
  id: number;
  name: string;
  country?: string;
  bankType: BankType;
  observationCount: number;
  createdAt: string;
}

export interface BankImportStats {
  totalRows: number;
  importedRows: number;
  newBanksCount: number;
  updatedBanksCount: number;
  errorCount: number;
  errors: string[];
  detectedFeatures: string[];
  detectedTargets: string[];
}

export interface TrainModelRequest {
  name: string;
  modelType: string;
  targetKey: string;
  featureKeys?: string[];
}

export interface StressModel {
  id: number;
  modelUuid: string;
  name: string;
  modelType: string;
  targetKey: string;
  featureKeys: string[];
  metrics: {
    mae?: number;
    rmse?: number;
    r2?: number;
  };
  createdAt: string;
}

export interface CreateScenarioRequest {
  name: string;
  description?: string;
  shocks: Record<string, number>;
}

export interface StressScenario {
  id: number;
  name: string;
  description?: string;
  shocks: Record<string, number>;
  createdByEmail?: string;
  createdAt: string;
}

export interface LaunchStressRunRequest {
  scenarioId: number;
  modelId: number;
}

export interface StressRun {
  id: number;
  scenarioId: number;
  scenarioName: string;
  modelId?: number;
  modelName?: string;
  targetKey?: string;
  status: StressRunStatus;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface BankTypeComparison {
  type: string;
  count: number;
  avgBaseline: number;
  avgStressed: number;
  avgDelta: number;
  maxDelta: number;
}

export interface StressResult {
  id: number;
  bankId: number;
  bankName: string;
  country?: string;
  bankType: BankType;
  baseline: Record<string, any>;
  stressed: Record<string, any>;
  delta: Record<string, any>;
  riskScore?: number;
}

export interface StressRunDetail extends StressRun {
  scenarioShocks: Record<string, number>;
  totalBanksCount: number;
  avgBaseline: number;
  avgStressed: number;
  avgDelta: number;
  maxDelta: number;
  mostImpactedBankName: string;
  conventionalStats?: BankTypeComparison;
  nonConventionalStats?: BankTypeComparison;
  topImpactedBanks: StressResult[];
  globalFeatureImportance?: Array<{
    feature: string;
    mean_abs_shap: number;
    importance: number;
  }>;
}

export interface XaiContribution {
  feature: string;
  value: number;
  contribution: number;
}

export interface LocalXaiExplanation {
  id: number;
  name?: string;
  base_value: number;
  predicted_value: number;
  contributions: XaiContribution[];
}

export interface XaiExplanationResponse {
  id: number;
  runId: number;
  bankId?: number;
  bankName?: string;
  explanationType: 'GLOBAL' | 'LOCAL';
  content: {
    mode?: string;
    base_value?: number;
    global_importance?: Array<{
      feature: string;
      mean_abs_shap: number;
      importance: number;
    }>;
    local_explanations?: LocalXaiExplanation[];
    contributions?: XaiContribution[];
  };
}

export const stressApi = {
  // Import CSV (Admin)
  importCsv: async (file: File): Promise<BankImportStats> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<BankImportStats>('/api/admin/stress/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Download template
  downloadTemplate: async (): Promise<Blob> => {
    const response = await api.get('/api/stress/template', { responseType: 'blob' });
    return response.data;
  },

  // ML Models
  trainModel: async (req: TrainModelRequest): Promise<StressModel> => {
    const response = await api.post<StressModel>('/api/admin/stress/models/train', req);
    return response.data;
  },

  getModels: async (): Promise<StressModel[]> => {
    const response = await api.get<StressModel[]>('/api/stress/models');
    return response.data;
  },

  // Scenarios
  getScenarios: async (): Promise<StressScenario[]> => {
    const response = await api.get<StressScenario[]>('/api/stress/scenarios');
    return response.data;
  },

  createScenario: async (req: CreateScenarioRequest): Promise<StressScenario> => {
    const response = await api.post<StressScenario>('/api/stress/scenarios', req);
    return response.data;
  },

  // Stress Runs
  launchRun: async (req: LaunchStressRunRequest): Promise<StressRun> => {
    const response = await api.post<StressRun>('/api/stress/runs', req);
    return response.data;
  },

  getRuns: async (): Promise<StressRun[]> => {
    const response = await api.get<StressRun[]>('/api/stress/runs');
    return response.data;
  },

  getRunDetail: async (id: number): Promise<StressRunDetail> => {
    const response = await api.get<StressRunDetail>(`/api/stress/runs/${id}`);
    return response.data;
  },

  getRunResults: async (id: number): Promise<StressResult[]> => {
    const response = await api.get<StressResult[]>(`/api/stress/runs/${id}/results`);
    return response.data;
  },

  getRunXai: async (id: number, type: 'GLOBAL' | 'LOCAL' = 'GLOBAL', bankId?: number): Promise<XaiExplanationResponse> => {
    const params: Record<string, any> = { type };
    if (bankId) params.bankId = bankId;
    const response = await api.get<XaiExplanationResponse>(`/api/stress/runs/${id}/xai`, { params });
    return response.data;
  },

  // Banks
  getBanks: async (): Promise<Bank[]> => {
    const response = await api.get<Bank[]>('/api/stress/banks');
    return response.data;
  }
};
