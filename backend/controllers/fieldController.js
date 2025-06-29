const db = require("../models");
const Field = db.Field;

exports.getAllFields = async (req, res) => {
  try {
    const fields = await Field.findAll();
    res.json(fields);
  } catch (err) {
    res.status(500).json({ message: "Sahalar alınamadı", error: err.message });
  }
};

exports.createField = async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Saha adı zorunludur" });
    }
    const newField = await Field.create({
      name,
      location: location || null,
    });
    res.status(201).json(newField);
  } catch (err) {
    res.status(500).json({ message: "Saha eklenemedi", error: err.message });
  }
};

exports.updateField = async (req, res) => {
  try {
    const { id } = req.params;
    const field = await Field.findByPk(id);
    if (!field) {
      return res.status(404).json({ message: "Saha bulunamadı" });
    }
    await field.update(req.body);
    res.json(field);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Saha güncellenemedi", error: err.message });
  }
};

exports.deleteField = async (req, res) => {
  try {
    const { id } = req.params;
    const field = await Field.findByPk(id);
    if (!field) {
      return res.status(404).json({ message: "Saha bulunamadı" });
    }
    await field.destroy();
    res.json({ message: "Saha silindi" });
  } catch (err) {
    res.status(500).json({ message: "Saha silinemedi", error: err.message });
  }
};
