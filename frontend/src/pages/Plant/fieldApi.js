import axios from "axios";
import API_BASE_URL from "../../config/api";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "/api/fields"
    : `${API_BASE_URL}/api/fields`;

export const getFields = () => axios.get(API_URL);
export const createField = (data) => axios.post(API_URL, data);
export const updateField = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deleteField = (id) => axios.delete(`${API_URL}/${id}`);
