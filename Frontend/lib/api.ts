export interface Feedback {
  id: string;
  type: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  userId?: string | null;
  userName?: string;
  userEmail?: string;
  isAnonymous?: boolean;
  createdAt: string;
  updatedAt: string;
  response?: string | null;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  unit: string;
  isDisabled?: boolean;
  isSuperAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminSession {
  username: string;
  expiresAt: string;
}

export interface Category {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  retCode: string;
  message: string;
  data: T;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:5566";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...restInit } = init ?? {};

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(initHeaders || {}),
    },
    credentials: "include",
    ...restInit,
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    const errorMessage =
      typeof payload?.data === "object" &&
      payload?.data &&
      "message" in payload.data
        ? String(payload.data.message)
        : payload?.message || "Request failed";

    throw new Error(errorMessage);
  }

  return payload.data;
}

export async function listFeedbacks(filters?: {
  category?: string;
  userId?: string;
}): Promise<Feedback[]> {
  const params = new URLSearchParams();

  if (filters?.category) {
    params.set("category", filters.category);
  }

  if (filters?.userId) {
    params.set("userId", filters.userId);
  }

  const query = params.toString();
  const data = await apiFetch<Feedback[] | null>(
    `/feedbacks${query ? `?${query}` : ""}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function getFeedback(id: string): Promise<Feedback> {
  return apiFetch<Feedback>(`/feedbacks/${encodeURIComponent(id)}`);
}

export async function createFeedback(
  payload: Omit<Feedback, "createdAt" | "updatedAt">,
): Promise<Feedback> {
  return apiFetch<Feedback>("/feedbacks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFeedback(
  id: string,
  payload: Partial<Feedback>,
): Promise<Feedback> {
  return apiFetch<Feedback>(`/feedbacks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  await apiFetch(`/feedbacks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function registerUser(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<User> {
  return apiFetch<User>("/auth/users/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<User> {
  return apiFetch<User>("/auth/users/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerAdmin(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  unit: string;
}): Promise<Admin> {
  return apiFetch<Admin>("/auth/admins/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAdmin(payload: {
  email: string;
  password: string;
}): Promise<Admin> {
  return apiFetch<Admin>("/auth/admins/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginSuperAdmin(payload: {
  username: string;
  password: string;
}): Promise<SuperAdminSession> {
  return apiFetch<SuperAdminSession>("/auth/superadmin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAdmins(): Promise<Admin[]> {
  const data = await apiFetch<Admin[] | null>("/superadmin/admins");
  return Array.isArray(data) ? data : [];
}

export async function listCategories(): Promise<Category[]> {
  const data = await apiFetch<Category[] | null>("/categories");
  return Array.isArray(data) ? data : [];
}

export async function createCategoryBySuperAdmin(
  payload: { name: string },
): Promise<Category[]> {
  return apiFetch<Category[]>("/superadmin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategoryBySuperAdmin(
  id: number,
  payload: { name: string },
): Promise<Category[]> {
  return apiFetch<Category[]>(`/superadmin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategoryBySuperAdmin(
  id: number,
): Promise<Category[]> {
  return apiFetch<Category[]>(`/superadmin/categories/${id}`, {
    method: "DELETE",
  });
}

export async function createAdminBySuperAdmin(
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    unit: string;
  },
): Promise<Admin> {
  return apiFetch<Admin>("/superadmin/admins", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBySuperAdmin(
  id: string,
  payload: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    unit: string;
  }>,
): Promise<Admin> {
  return apiFetch<Admin>(`/superadmin/admins/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBySuperAdmin(
  id: string,
): Promise<void> {
  await apiFetch(`/superadmin/admins/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function disableAdminBySuperAdmin(
  id: string,
): Promise<Admin> {
  return apiFetch<Admin>(`/superadmin/admins/${encodeURIComponent(id)}/disable`, {
    method: "PUT",
  });
}

export async function enableAdminBySuperAdmin(
  id: string,
): Promise<Admin> {
  return apiFetch<Admin>(`/superadmin/admins/${encodeURIComponent(id)}/enable`, {
    method: "PUT",
  });
}

export async function reverifyAdmin(password: string): Promise<void> {
  await apiFetch("/auth/admins/reverify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function reverifySuperAdmin(password: string): Promise<void> {
  await apiFetch("/auth/superadmin/reverify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function getSessionMe(): Promise<{
  role: string;
  userId?: string | null;
  adminId?: string | null;
}> {
  return apiFetch("/auth/session");
}

export async function updateUserProfile(
  id: string,
  payload: { firstName: string; lastName: string },
): Promise<User> {
  return apiFetch<User>(`/auth/users/${encodeURIComponent(id)}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateUserPassword(
  id: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<void> {
  await apiFetch(`/auth/users/${encodeURIComponent(id)}/password`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUserAccount(id: string): Promise<void> {
  await apiFetch(`/auth/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function updateAdminPassword(
  id: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<void> {
  await apiFetch(`/auth/admins/${encodeURIComponent(id)}/password`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminAccount(id: string): Promise<void> {
  await apiFetch(`/auth/admins/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function updateAdminProfile(
  id: string,
  payload: { firstName: string; lastName: string },
): Promise<Admin> {
  return apiFetch<Admin>(`/auth/admins/${encodeURIComponent(id)}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
