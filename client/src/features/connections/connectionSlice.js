// connectionSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from '../../api/axios.js';

// ✅ async thunk to fetch connections
export const fetchConnection = createAsyncThunk(
    "connections/fetchConnection",
    async (token) => {
        const { data } = await api.get('/api/user/connections', {
            headers: { Authorization: `Bearer ${token}` },
        });
        return data;
    }
);

const initialState = {
    connections: [],
    pendingConnections: [],
    followers: [],
    following: [],
    status: "idle",
};

const connectionsSlice = createSlice({
    name: "connections",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchConnection.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchConnection.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.connections = action.payload.connections || [];
                state.followers = action.payload.followers || [];
                state.following = action.payload.following || [];
                state.pendingConnections = action.payload.pendingConnections || [];
            })
            .addCase(fetchConnection.rejected, (state) => {
                state.status = "failed";
            });
    },
});

export default connectionsSlice.reducer;
