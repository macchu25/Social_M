import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import Sidebar from "../components/Sidebar";
import Loading from "../components/Loading";

import { fetchUser } from "../features/user/userSlice";

const Layout = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.value);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Gọi API lấy thông tin user khi load trang
  useEffect(() => {
    const token = localStorage.getItem("token"); // lấy token lưu khi đăng nhập
    if (token) {
      dispatch(fetchUser(token)); // gọi API lấy user từ server
    }
  }, [dispatch]);

  if (!user) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loading /> {/* hoặc <h1>loading...</h1> nếu bạn chưa có component Loading */}
      </div>
    );
  }

  return (
    <div className="w-full flex h-screen relative">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Nội dung chính */}
      <div className="flex-1 bg-slate-50 overflow-y-auto">
        <Outlet />
      </div>

      {/* Nút toggle sidebar (chỉ hiện trên mobile) */}
      {sidebarOpen ? (
        <X
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-2 z-50 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden cursor-pointer"
        />
      ) : (
        <Menu
          onClick={() => setSidebarOpen(true)}
          className="absolute top-3 right-3 p-2 z-50 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden cursor-pointer"
        />
      )}
    </div>
  );
};

export default Layout;
