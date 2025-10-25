import { toast } from 'react-hot-toast'
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/axios.js'

const initialState = {
  value: null,
}

// 🧠 Lấy thông tin user từ token
export const fetchUser = createAsyncThunk('user/fetchUser', async (token) => {
  const { data } = await api.get('/api/user/data', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.success ? data.user : null
})

// ✏️ Cập nhật thông tin user
export const updateUser = createAsyncThunk('user/update', async ({ token, userData }) => {
  const { data } = await api.post('/api/user/update', userData, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (data.success) {
    toast.success(data.message)
    return data.user
  } else {
    toast.error(data.message)
    return null
  }
})

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.value = action.payload
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.value = action.payload
      })
  },
})

export default userSlice.reducer
