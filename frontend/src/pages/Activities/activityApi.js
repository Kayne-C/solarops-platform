import axios from "axios";
import API_BASE_URL from "../../config/api";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "/api/activities"
    : `${API_BASE_URL}/api/activities`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getActivities = () =>
  axios.get(API_URL, { headers: getAuthHeader() });

export const getActivity = (id) =>
  axios.get(`${API_URL}/${id}`, { headers: getAuthHeader() });

export const createActivity = (data) =>
  axios.post(API_URL, data, { headers: getAuthHeader() });

export const updateActivity = (id, data) =>
  axios.put(`${API_URL}/${id}`, data, { headers: getAuthHeader() });
