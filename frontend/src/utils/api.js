import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND,
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            const currentHash = window.location.hash;
            if (currentHash !== "#/" && currentHash !== "" && currentHash !== "#/oauth-success") {
                localStorage.removeItem("token");
                localStorage.removeItem("role");
                window.location.hash = "#/";
            }
        }
        return Promise.reject(error);
    }
);

export default api;
