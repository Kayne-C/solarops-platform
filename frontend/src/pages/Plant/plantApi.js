import axios from "axios";
import API_BASE_URL from "../../config/api";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "/api/plants"
    : `${API_BASE_URL}/api/plants`;

export const getPlants = () => axios.get(API_URL);
export const getPlant = (id) => axios.get(`${API_URL}/${id}`);
export const createPlant = (data) => axios.post(API_URL, data);
export const updatePlant = (id, data) => axios.put(`${API_URL}/${id}`, data);
export const deletePlant = (id) => axios.delete(`${API_URL}/${id}`);
