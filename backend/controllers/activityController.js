const db = require("../models");
const Activity = db.Activity;
const WorkOrder = db.WorkOrder;
const User = db.User;
const ActivityAttachment = db.ActivityAttachment;
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Dosya yükleme için storage konfigürasyonu
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "uploads", "activities");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Tüm aktiviteler
exports.getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.findAll({
      include: [
        {
          model: WorkOrder,
          attributes: ["id", "description"],
          include: [{ model: db.Plant, attributes: ["id", "name"] }],
        },
        { model: User, attributes: ["id", "username"] },
        {
          model: ActivityAttachment,
          attributes: ["id", "file_name", "file_path"],
        },
      ],
      order: [["created_at", "DESC"]],
    });
    res.json(activities);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Aktiviteler alınamadı", error: err.message });
  }
};

// Tekil aktivite
exports.getActivity = async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id, {
      include: [
        {
          model: WorkOrder,
          attributes: ["id", "description"],
          include: [{ model: db.Plant, attributes: ["id", "name"] }],
        },
        { model: User, attributes: ["id", "username"] },
        {
          model: ActivityAttachment,
          attributes: ["id", "file_name", "file_path"],
        },
      ],
    });
    if (!activity)
      return res.status(404).json({ message: "Aktivite bulunamadı" });
    res.json(activity);
  } catch (err) {
    res.status(500).json({ message: "Aktivite alınamadı", error: err.message });
  }
};

// Aktivite oluştur
exports.createActivity = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Request files:", req.files);

    const { work_order_id, description, user_id } = req.body;

    if (!work_order_id || !description || !user_id) {
      return res.status(400).json({
        message: "Zorunlu alanlar eksik",
        received: { work_order_id, description, user_id },
      });
    }

    const activity = await Activity.create({
      work_order_id,
      description,
      user_id,
    });

    // Dosya yükleme işlemi
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map((file) => ({
        activity_id: activity.id,
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size,
      }));

      await ActivityAttachment.bulkCreate(attachments);
    }

    const createdActivity = await Activity.findByPk(activity.id, {
      include: [
        { model: WorkOrder, attributes: ["id", "description"] },
        { model: User, attributes: ["id", "username"] },
        {
          model: ActivityAttachment,
          attributes: ["id", "file_name", "file_path"],
        },
      ],
    });

    res.status(201).json(createdActivity);
  } catch (err) {
    console.error("Error creating activity:", err);
    res
      .status(500)
      .json({ message: "Aktivite oluşturulamadı", error: err.message });
  }
};

// Aktivite güncelle
exports.updateActivity = async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity)
      return res.status(404).json({ message: "Aktivite bulunamadı" });

    await activity.update(req.body);

    // Yeni dosya yükleme işlemi
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map((file) => ({
        activity_id: activity.id,
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size,
      }));

      await ActivityAttachment.bulkCreate(attachments);
    }

    const updatedActivity = await Activity.findByPk(activity.id, {
      include: [
        { model: WorkOrder, attributes: ["id", "title", "description"] },
        { model: User, attributes: ["id", "username"] },
        {
          model: ActivityAttachment,
          attributes: ["id", "file_name", "file_path"],
        },
      ],
    });

    res.json(updatedActivity);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Aktivite güncellenemedi", error: err.message });
  }
};

// Aktivite sil
exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id, {
      include: [{ model: ActivityAttachment }],
    });

    if (!activity)
      return res.status(404).json({ message: "Aktivite bulunamadı" });

    // Dosyaları fiziksel olarak sil
    if (activity.ActivityAttachments) {
      for (const attachment of activity.ActivityAttachments) {
        if (fs.existsSync(attachment.file_path)) {
          fs.unlinkSync(attachment.file_path);
        }
      }
    }

    await activity.destroy();
    res.json({ message: "Aktivite başarıyla silindi" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Aktivite silinemedi", error: err.message });
  }
};
