import { toast } from 'react-hot-toast'
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/axios.js'

const initialState = {
  value: null,
  discoveredUsers: [],
  discoverLoading: false,
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

// 🔍 Tìm kiếm người dùng
export const discoverUsers = createAsyncThunk('user/discoverUsers', async ({ token, input }) => {
  const { data } = await api.post('/api/user/discover', { input }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (data.success) {
    return data.users
  } else {
    toast.error(data.message)
    return []
  }
})

// ➕ Follow user
export const followUser = createAsyncThunk('user/follow', async ({ token, id }) => {
  const { data } = await api.post('/api/user/follow', { id }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!data.success) {
    toast.error(data.message)
    throw new Error(data.message)
  }
  toast.success(data.message)
  return { id }
})

// ➖ Unfollow user
export const unfollowUser = createAsyncThunk('user/unfollow', async ({ token, id }) => {
  const { data } = await api.post('/api/user/unfollow', { id }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!data.success) {
    toast.error(data.message)
    throw new Error(data.message)
  }
  toast.success(data.message)
  return { id }
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
      .addCase(discoverUsers.pending, (state) => {
        state.discoverLoading = true
      })
      .addCase(discoverUsers.fulfilled, (state, action) => {
        state.discoveredUsers = action.payload
        state.discoverLoading = false
      })
      .addCase(discoverUsers.rejected, (state) => {
        state.discoverLoading = false
      })
      // follow
      .addCase(followUser.fulfilled, (state, action) => {
        const followedId = action.payload.id
        if (state.value) {
          const following = state.value.following || []
          if (!following.includes(followedId)) {
            state.value.following = [...following, followedId]
          }
        }
        // bump followers count in discovered list if present
        state.discoveredUsers = state.discoveredUsers.map(u =>
          u._id === followedId
            ? { ...u, followers: Array.isArray(u.followers) ? [...u.followers, state.value?._id].filter(Boolean) : [state.value?._id].filter(Boolean) }
            : u
        )
      })
      .addCase(unfollowUser.fulfilled, (state, action) => {
        const unfollowedId = action.payload.id
        if (state.value) {
          state.value.following = (state.value.following || []).filter(id => id !== unfollowedId)
        }
        state.discoveredUsers = state.discoveredUsers.map(u =>
          u._id === unfollowedId
            ? { ...u, followers: Array.isArray(u.followers) ? u.followers.filter(id => id !== state.value?._id) : [] }
            : u
        )
      })
  },
})

export default userSlice.reducer
