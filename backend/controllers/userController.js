const db = require("../models");
const bcrypt = require("bcryptjs");
const User = db.User;

// Tüm kullanıcıları getir
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password_hash"] },
    });
    res.json(users);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Kullanıcılar alınamadı", error: err.message });
  }
};

// Yeni kullanıcı ekle
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role, phone } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "Tüm alanlar zorunlu." });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Bu email ile kayıtlı kullanıcı var." });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password_hash,
      role,
      phone,
    });
    res
      .status(201)
      .json({
        message: "Kullanıcı eklendi",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          phone: user.phone,
        },
      });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Kullanıcı eklenemedi", error: err.message });
  }
};

// Kullanıcıyı güncelle
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role, phone } = req.body;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    let updateData = { username, email, role, phone };
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    await user.update(updateData);
    res.json({
      message: "Kullanıcı güncellendi",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Kullanıcı güncellenemedi", error: err.message });
  }
};

// Kullanıcıyı sil
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    await user.destroy();
    res.json({ message: "Kullanıcı silindi" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Kullanıcı silinemedi", error: err.message });
  }
};
