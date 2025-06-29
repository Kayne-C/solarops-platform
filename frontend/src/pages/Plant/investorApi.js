import axios from "axios";
import API_BASE_URL from "../../config/api";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "/api/investors"
    : `${API_BASE_URL}/api/investors`;

export const getInvestors = () => axios.get(API_URL);
export const createInvestor = (data) => axios.post(API_URL, data);
export const updateInvestor = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deleteInvestor = (id) => axios.delete(`${API_URL}/${id}`);
