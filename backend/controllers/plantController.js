const db = require("../models");
const Plant = db.Plant;
const Investor = db.Investor;
const Field = db.Field;

exports.getAllPlants = async (req, res) => {
  try {
    const plants = await Plant.findAll({
      include: [
        { model: Investor, as: "Investor", attributes: ["id", "company_name"] },
        { model: Field, as: "Field", attributes: ["id", "name"] },
      ],
    });
    res.json(plants);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Santraller alınamadı", error: err.message });
  }
};

exports.getPlant = async (req, res) => {
  try {
    const plant = await Plant.findByPk(req.params.id, {
      include: [
        { model: Investor, as: "Investor", attributes: ["id", "company_name"] },
        { model: Field, as: "Field", attributes: ["id", "name"] },
      ],
    });
    if (!plant) return res.status(404).json({ message: "Santral bulunamadı" });
    res.json(plant);
  } catch (err) {
    res.status(500).json({ message: "Santral alınamadı", error: err.message });
  }
};

exports.createPlant = async (req, res) => {
  try {
    const plant = await Plant.create(req.body);
    res.status(201).json(plant);
  } catch (err) {
    res.status(500).json({ message: "Santral eklenemedi", error: err.message });
  }
};

exports.updatePlant = async (req, res) => {
  try {
    const plant = await Plant.findByPk(req.params.id);
    if (!plant) return res.status(404).json({ message: "Santral bulunamadı" });
    await plant.update(req.body);
    res.json(plant);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Santral güncellenemedi", error: err.message });
  }
};

exports.deletePlant = async (req, res) => {
  try {
    const plant = await Plant.findByPk(req.params.id);
    if (!plant) return res.status(404).json({ message: "Santral bulunamadı" });
    await plant.destroy();
    res.json({ message: "Santral silindi" });
  } catch (err) {
    res.status(500).json({ message: "Santral silinemedi", error: err.message });
  }
};
