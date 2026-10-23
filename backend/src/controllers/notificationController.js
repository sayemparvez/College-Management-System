const db = require("../config/db");

// Helper to create notifications from any controller
exports.createNotification = async ({
    userprofile = "all", // 'admin', 'faculty', 'student', 'all'
    courcecode = null,
    semoryear = null,
    userid = null, // specific email or null for all in that profile
    title,
    message
}) => {
    try {
        const time = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
        await db.query(
            `INSERT INTO notification (userprofile, courcecode, semoryear, userid, title, message, time, readby)
             VALUES ($1, $2, $3, $4, $5, $6, $7, '')`,
            [userprofile, courcecode, semoryear, userid, title, message, time]
        );
    } catch (err) {
        console.error("Error creating notification:", err);
    }
};

// GET /api/notifications
exports.getNotifications = async (req, res) => {
    try {
        const userEmail = req.user?.email || "";
        const role = (req.user?.role || "").toLowerCase();

        let studentClass = null;
        let studentSem = null;

        if (role === "student") {
            const studentRes = await db.query(
                "SELECT Courcecode, semoryear FROM students WHERE emailid = $1",
                [userEmail]
            );
            if (studentRes.rows.length > 0) {
                studentClass = studentRes.rows[0].courcecode;
                studentSem = studentRes.rows[0].semoryear;
            }
        }

        // Query relevant notifications
        let query = `
            SELECT sr_no, userprofile, courcecode, semoryear, userid, title, message, time, readby, created_at
            FROM notification
            WHERE (
                userprofile = 'all' 
                OR userprofile = $1 
                OR (userid = $2)
            )
        `;
        const params = [role, userEmail];

        if (role === "student" && studentClass) {
            query += ` AND (courcecode IS NULL OR courcecode = $3)`;
            params.push(studentClass);
        }

        query += ` ORDER BY sr_no DESC LIMIT 30`;

        const result = await db.query(query, params);

        const notifications = result.rows.map(item => {
            const readList = (item.readby || "").split(",").map(e => e.trim().toLowerCase());
            const isRead = readList.includes(userEmail.toLowerCase());
            return {
                id: item.sr_no,
                title: item.title,
                message: item.message,
                time: item.time,
                createdAt: item.created_at,
                isRead
            };
        });

        const unreadCount = notifications.filter(n => !n.isRead).length;

        res.json({
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
};

// PUT /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.user?.email || "";

        const notifRes = await db.query(
            "SELECT readby FROM notification WHERE sr_no = $1",
            [id]
        );

        if (notifRes.rows.length > 0) {
            let readby = notifRes.rows[0].readby || "";
            const readList = readby.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
            if (!readList.includes(userEmail.toLowerCase())) {
                readList.push(userEmail.toLowerCase());
                await db.query(
                    "UPDATE notification SET readby = $1 WHERE sr_no = $2",
                    [readList.join(","), id]
                );
            }
        }

        res.json({ message: "Notification marked as read" });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ message: "Failed to update notification" });
    }
};

// PUT /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
    try {
        const userEmail = req.user?.email || "";
        const role = (req.user?.role || "").toLowerCase();

        // Fetch unread notifications for this user and append userEmail to readby
        const result = await db.query(
            `SELECT sr_no, readby FROM notification 
             WHERE userprofile = 'all' OR userprofile = $1 OR userid = $2`,
            [role, userEmail]
        );

        for (const row of result.rows) {
            let readList = (row.readby || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
            if (!readList.includes(userEmail.toLowerCase())) {
                readList.push(userEmail.toLowerCase());
                await db.query(
                    "UPDATE notification SET readby = $1 WHERE sr_no = $2",
                    [readList.join(","), row.sr_no]
                );
            }
        }

        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ message: "Failed to update notifications" });
    }
};
