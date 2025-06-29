const db = require("../models");
const Investor = db.Investor;

exports.getAllInvestors = async (req, res) => {
  try {
    const investors = await Investor.findAll();
    res.json(investors);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Yatırımcılar alınamadı", error: err.message });
  }
};

exports.createInvestor = async (req, res) => {
  try {
    const { company_name, contact_person, email, phone, address } = req.body;
    if (!company_name) {
      return res.status(400).json({ message: "Şirket adı zorunludur" });
    }
    const newInvestor = await Investor.create({
      company_name,
      contact_person: contact_person || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
    });
    res.status(201).json(newInvestor);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Yatırımcı eklenemedi", error: err.message });
  }
};

exports.updateInvestor = async (req, res) => {
  try {
    const { id } = req.params;
    const investor = await Investor.findByPk(id);
    if (!investor) {
      return res.status(404).json({ message: "Yatırımcı bulunamadı" });
    }
    await investor.update(req.body);
    res.json(investor);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Yatırımcı güncellenemedi", error: err.message });
  }
};

exports.deleteInvestor = async (req, res) => {
  try {
    const { id } = req.params;
    const investor = await Investor.findByPk(id);
    if (!investor) {
      return res.status(404).json({ message: "Yatırımcı bulunamadı" });
    }
    await investor.destroy();
    res.json({ message: "Yatırımcı silindi" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Yatırımcı silinemedi", error: err.message });
  }
};
