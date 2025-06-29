const db = require("../models");
const WorkOrder = db.WorkOrder;
const Plant = db.Plant;
const User = db.User;
const WorkOrderAssignee = db.WorkOrderAssignee;
const Activity = db.Activity;
const ActivityAttachment = db.ActivityAttachment;
const Field = db.Field;

// Tüm iş emirleri
exports.getAllWorkOrders = async (req, res) => {
  try {
    const workOrders = await WorkOrder.findAll({
      include: [
        {
          model: Plant,
          as: "Plant",
          attributes: [
            "id",
            "name",
            "field_id",
            "type",
            "power",
            "pv_module",
            "inverter",
          ],
          include: [{ model: Field, as: "Field", attributes: ["id", "name"] }],
        },
        { model: User, as: "User", attributes: ["id", "username"] },
        {
          model: User,
          through: { attributes: [] },
          as: "Users",
          attributes: ["id", "username"],
        },
      ],
      attributes: { exclude: ["PlantId"] },
      order: [["createdAt", "DESC"]],
    });
    res.json(workOrders);
  } catch (err) {
    res
      .status(500)
      .json({ message: "İş emirleri alınamadı", error: err.message });
  }
};

// Tekil iş emri
exports.getWorkOrder = async (req, res) => {
  try {
    const workOrder = await WorkOrder.findByPk(req.params.id, {
      include: [
        {
          model: Plant,
          as: "Plant",
          attributes: [
            "id",
            "name",
            "field_id",
            "type",
            "power",
            "pv_module",
            "inverter",
          ],
          include: [{ model: Field, as: "Field", attributes: ["id", "name"] }],
        },
        { model: User, as: "User", attributes: ["id", "username"] },
        {
          model: User,
          through: { attributes: [] },
          as: "Users",
          attributes: ["id", "username"],
        },
        {
          model: Activity,
          as: "Activities",
          include: [
            { model: User, attributes: ["id", "username"] },
            {
              model: ActivityAttachment,
              attributes: ["id", "file_name", "file_path"],
            },
          ],
          order: [["created_at", "DESC"]],
        },
      ],
      attributes: { exclude: ["PlantId"] },
    });
    if (!workOrder)
      return res.status(404).json({ message: "İş emri bulunamadı" });
    res.json(workOrder);
  } catch (err) {
    res.status(500).json({ message: "İş emri alınamadı", error: err.message });
  }
};

// İş emri güncelle
exports.updateWorkOrder = async (req, res) => {
  try {
    const workOrder = await WorkOrder.findByPk(req.params.id);
    if (!workOrder)
      return res.status(404).json({ message: "İş emri bulunamadı" });

    // Eğer status 'COMPLETED' olarak güncelleniyorsa completed_at alanını set et
    let updateData = { ...req.body };
    if (updateData.status === "COMPLETED" && workOrder.status !== "COMPLETED") {
      updateData.completed_at = new Date();
    }
    // Eğer tekrar başka bir statüye çekilirse completed_at null olsun (isteğe bağlı)
    if (
      updateData.status &&
      updateData.status !== "COMPLETED" &&
      workOrder.status === "COMPLETED"
    ) {
      updateData.completed_at = null;
    }

    await workOrder.update(updateData);
    res.json(workOrder);
  } catch (err) {
    res
      .status(500)
      .json({ message: "İş emri güncellenemedi", error: err.message });
  }
};

// İş emri oluştur
exports.createWorkOrder = async (req, res) => {
  try {
    const {
      description,
      plant_id,
      type,
      status,
      priority,
      created_by,
      assignees,
    } = req.body;
    if (!plant_id || !type || !priority || !created_by) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik" });
    }
    // title olmadan oluştur
    const newWorkOrder = await WorkOrder.create({
      description,
      plant_id,
      type,
      status: status || "PENDING",
      priority,
      created_by,
    });

    // Seçili personelleri work_order_assignees tablosuna ekle
    if (assignees && Array.isArray(assignees)) {
      await Promise.all(
        assignees.map((user_id) =>
          WorkOrderAssignee.create({
            work_order_id: newWorkOrder.id,
            user_id,
          })
        )
      );
    }

    res.status(201).json(newWorkOrder);
  } catch (err) {
    res
      .status(500)
      .json({ message: "İş emri oluşturulamadı", error: err.message });
  }
};

exports.assignPersonnel = async (req, res) => {
  try {
    const { work_order_id, personnel_id } = req.body;
    const workOrder = await WorkOrder.findByPk(work_order_id);
    if (!workOrder)
      return res.status(404).json({ message: "İş emri bulunamadı" });
    await workOrder.update({ status: "IN_PROGRESS" });
    res.json(workOrder);
  } catch (err) {
    res.status(500).json({ message: "Personel atanamadı", error: err.message });
  }
};
