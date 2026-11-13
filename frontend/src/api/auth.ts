import api from './axios';

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType?: string;
}

export interface UserProfile {
  id: number;
  email: string;
  role: 'USER' | 'ADMIN';
}

export const registerUser = async (data: RegisterPayload): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/api/auth/register', data);
  return response.data;
};

export const loginUser = async (data: LoginPayload): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/api/auth/login', data);
  return response.data;
};

export const getMe = async (): Promise<UserProfile> => {
  const response = await api.get<UserProfile>('/api/me');
  return response.data;
};
