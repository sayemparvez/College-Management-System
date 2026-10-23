import { useState, useEffect, useRef } from "react";
import {
    Menu,
    Moon,
    Sun,
    LogOut,
    Bell,
    CheckCheck,
    Clock,
    X,
    AlertCircle
} from "lucide-react";
import api from "../../utils/api";

const AppHeader = ({
    title,
    theme,
    toggleSidebar,
    toggleTheme,
    handleLogout,
}) => {
    const token = localStorage.getItem("token");
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = async () => {
        if (!token) return;
        try {
            const res = await api.get("/api/notifications", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch (err) {
            // Silently handle if unauthenticated
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Refresh notifications every 60 seconds
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [token]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.put("/api/notifications/read-all", {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
            <div className="flex items-center justify-between px-4 sm:px-8 h-16">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                        aria-label="Toggle sidebar"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200 hidden sm:block">
                        {title}
                    </h1>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {/* NOTIFICATION BELL */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setShowDropdown(!showDropdown);
                                if (!showDropdown) fetchNotifications();
                            }}
                            className="relative p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors focus:outline-none"
                            title="Notifications"
                            aria-label="Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-extrabold text-white animate-pulse">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* NOTIFICATIONS DROPDOWN */}
                        {showDropdown && (
                            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-3.5 px-4 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            বিজ্ঞপ্তি ও নোটিফিকেশন
                                        </span>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                {unreadCount}টি নতুন
                                            </span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                        >
                                            <CheckCheck className="w-3.5 h-3.5" />
                                            সব পঠিত
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            বর্তমানে কোনো নতুন বিজ্ঞপ্তি নেই
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                                                className={`p-3.5 px-4 transition-colors cursor-pointer text-left ${
                                                    !n.isRead
                                                        ? "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-80"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className={`text-xs ${!n.isRead ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"}`}>
                                                        {n.title}
                                                    </h4>
                                                    {!n.isRead && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0 mt-1" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                                                    {n.message}
                                                </p>
                                                {n.time && (
                                                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{n.time}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* THEME TOGGLE */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors focus:outline-none"
                        title="Toggle Theme"
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>

                    <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1" />

                    {/* SIGN OUT */}
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus:outline-none group"
                    >
                        <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        <span className="hidden sm:inline">
                            Sign Out
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
