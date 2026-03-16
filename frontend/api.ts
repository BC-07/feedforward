// API service layer — all backend calls go through here.
// The base URL is proxied via Next.js rewrites (next.config.ts),
// so we call /api/* which gets forwarded to the Go backend.

const API_BASE = "/api";

export interface ApiResponse<T = unknown> {
  retCode: string;
  message: string;
  data: T;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
}

export interface AdminData {
  id: string;
  name: string;
  email: string;
  unit: string;
}

export interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  unit: string;
  isDisabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface FeedbackData {
  id: string;
  type: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  userId: string;
  userName: string;
  isAnonymous: boolean;
  response?: string;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) {
    // Throw the message from the backend response
    throw new Error(json.message || "Request failed");
  }
  return json as ApiResponse<T>;
}

function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function del<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: "DELETE" });
}

function get<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: "GET" });
}

// ===================== USER API =====================

export const registerUser = (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
}) => post<UserData>("/users/register", data);

export const loginUser = (data: { email: string; password: string }) =>
  post<UserData>("/users/login", data);

// ===================== ADMIN API =====================

export const registerAdmin = (data: {
  adminKey: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  unit: string;
}) => post<AdminData>("/admins/register", data);

export const loginAdmin = (data: { email: string; password: string }) =>
  post<AdminData>("/admins/login", data);

export const updateAdminUnit = (adminId: string, unit: string) =>
  put<{ unit: string }>(`/admins/${adminId}/unit`, { unit });

// ===================== FEEDBACK API =====================

export const submitFeedback = (data: {
  type: string;
  category: string;
  subject: string;
  message: string;
  userId: string;
  userName: string;
  isAnonymous: boolean;
}) => post<FeedbackData>("/feedbacks", data);

export const getFeedbackById = (id: string) =>
  get<FeedbackData>(`/feedbacks/${id}`);

export const getFeedbacksByUser = (userId: string) =>
  get<FeedbackData[]>(`/feedbacks/user/${userId}`);

export const getFeedbacksByUnit = (unit: string) =>
  get<FeedbackData[]>(`/feedbacks/unit/${encodeURIComponent(unit)}`);

export const updateFeedback = (
  id: string,
  data: { status?: string; priority?: string; response?: string },
) => put<FeedbackData>(`/feedbacks/${id}`, data);

export const deleteFeedback = (id: string) =>
  del<string>(`/feedbacks/${id}`);

// ===================== SUPERADMIN API =====================

async function requestWithToken<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const { headers: extraHeaders, ...restOptions } = options ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      "X-SuperAdmin-Token": token,
      ...(extraHeaders as Record<string, string>),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || "Request failed");
  }
  return json as ApiResponse<T>;
}

export const superAdminLogin = (key: string) =>
  post<{ token: string; name: string; expiresAt: string }>("/superadmin/login", { key });

export const listAdmins = async (token: string): Promise<Admin[]> => {
  const res = await requestWithToken<Admin[]>("/superadmin/admins", token, { method: "GET" });
  return res.data;
};

export const createAdminBySuperAdmin = (
  token: string,
  data: { firstName: string; lastName: string; email: string; password: string; unit: string },
) => requestWithToken<Admin>("/superadmin/admins", token, {
  method: "POST",
  body: JSON.stringify(data),
});

export const updateAdminBySuperAdmin = (
  token: string,
  id: string,
  data: { firstName: string; lastName: string; email: string; password: string; unit: string },
) => requestWithToken<Admin>(`/superadmin/admins/${id}`, token, {
  method: "PUT",
  body: JSON.stringify(data),
});

export const deleteAdminBySuperAdmin = (token: string, id: string) =>
  requestWithToken<string>(`/superadmin/admins/${id}`, token, { method: "DELETE" });

export const disableAdminBySuperAdmin = (token: string, id: string) =>
  requestWithToken<Admin>(`/superadmin/admins/${id}/disable`, token, { method: "PATCH" });

// ===================== CATEGORY API =====================

export const listCategories = async (): Promise<Category[]> => {
  const res = await request<Category[]>("/superadmin/categories", { method: "GET" });
  return res.data;
};

export const createCategoryBySuperAdmin = async (
  token: string,
  data: { name: string },
): Promise<Category[]> => {
  const res = await requestWithToken<Category[]>("/superadmin/categories", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
};

export const updateCategoryBySuperAdmin = async (
  token: string,
  id: number,
  data: { name: string },
): Promise<Category[]> => {
  const res = await requestWithToken<Category[]>(`/superadmin/categories/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
};

export const deleteCategoryBySuperAdmin = async (
  token: string,
  id: number,
): Promise<Category[]> => {
  const res = await requestWithToken<Category[]>(`/superadmin/categories/${id}`, token, {
    method: "DELETE",
  });
  return res.data;
};
