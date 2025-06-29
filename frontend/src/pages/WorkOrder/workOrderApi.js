import axios from "axios";
import API_BASE_URL from "../../config/api";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "/api/work-orders"
    : `${API_BASE_URL}/api/work-orders`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getWorkOrders = () =>
  axios.get(API_URL, { headers: getAuthHeader() });
export const getWorkOrder = (id) =>
  axios.get(`${API_URL}/${id}`, { headers: getAuthHeader() });
export const updateWorkOrder = (id, data) =>
  axios.put(`${API_URL}/${id}`, data, { headers: getAuthHeader() });
export const createWorkOrder = (data) =>
  axios.post(API_URL, data, { headers: getAuthHeader() });
