import api from "../../services/api";

const useCompanies = () => {
    const requestWithFallback = async (requests = []) => {
        let lastError;

        for (const request of requests) {
            try {
                const response = await api.request(request);
                return response.data;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    };

    const save = async (data) => {
        const { data: responseData } = await api.request({
            url: '/companies',
            method: 'POST',
            data
        });
        return responseData;
    }

    const findAll = async (id) => {
        const { data } = await api.request({
            url: `/companies`,
            method: 'GET'
        });
        return data;
    }

    const list = async (id) => {
        const data = await requestWithFallback([
            {
                url: `/companies/list`,
                method: "GET"
            },
            {
                url: `/companiesPlan`,
                method: "GET"
            },
            {
                url: `/companies`,
                method: "GET",
                params: {
                    pageNumber: "1",
                    searchParam: ""
                }
            }
        ]);

        if (Array.isArray(data)) {
            return data;
        }

        if (Array.isArray(data?.companies)) {
            return data.companies;
        }

        if (Array.isArray(data?.records)) {
            return data.records;
        }

        return [];
    }

    const find = async (id) => {
        const { data } = await api.request({
            url: `/companies/${id}`,
            method: 'GET'
        });
        return data;
    }

    const getStorageUsage = async (id) => {
        const { data } = await api.request({
            url: `/companies/${id}/storage-usage`,
            method: 'GET'
        });
        return data;
    }

    const update = async (data) => {
        const { data: responseData } = await api.request({
            url: `/companies/${data.id}`,
            method: 'PUT',
            data
        });
        return responseData;
    }

    const remove = async (id) => {
        const { data } = await api.request({
            url: `/companies/${id}`,
            method: 'DELETE'
        });
        return data;
    }

    const updateSchedules = async (data) => {
        const { data: responseData } = await api.request({
            url: `/companies/${data.id}/schedules`,
            method: 'PUT',
            data
        });
        return responseData;
    }

    return {
        save,
        update,
        remove,
        list,
        find,
        getStorageUsage,
        findAll,
        updateSchedules
    }
}

export default useCompanies;
