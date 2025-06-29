const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: false,
  }
);

const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.User = require("./user")(sequelize, Sequelize);
db.Investor = require("./investor")(sequelize, Sequelize);
db.Field = require("./field")(sequelize, Sequelize);
db.Plant = require("./plant")(sequelize, Sequelize);
db.WorkOrder = require("./workOrder")(sequelize, Sequelize);
db.WorkOrderAssignee = require("./workOrderAssignee")(sequelize, Sequelize);
db.Activity = require("./activity")(sequelize, Sequelize);
db.ActivityAttachment = require("./activityAttachment")(sequelize, Sequelize);
db.DailyProduction = require("./dailyProduction")(sequelize, Sequelize);
db.PVSystReport = require("./pvsystReport")(sequelize, Sequelize);

// İlişkiler
db.Investor.hasMany(db.Plant, { foreignKey: "investor_id" });
db.Plant.belongsTo(db.Investor, { foreignKey: "investor_id", as: "Investor" });

db.Field.hasMany(db.Plant, { foreignKey: "field_id" });
db.Plant.belongsTo(db.Field, { foreignKey: "field_id", as: "Field" });

db.Plant.hasMany(db.WorkOrder);
db.WorkOrder.belongsTo(db.Plant);

db.User.hasMany(db.WorkOrder, { foreignKey: "created_by" });
db.WorkOrder.belongsTo(db.User, { foreignKey: "created_by" });

db.WorkOrder.belongsToMany(db.User, {
  through: db.WorkOrderAssignee,
  foreignKey: "work_order_id",
  otherKey: "user_id",
});
db.User.belongsToMany(db.WorkOrder, {
  through: db.WorkOrderAssignee,
  foreignKey: "user_id",
  otherKey: "work_order_id",
});

db.WorkOrder.hasMany(db.Activity);
db.Activity.belongsTo(db.WorkOrder);

db.User.hasMany(db.Activity);
db.Activity.belongsTo(db.User);

db.Activity.hasMany(db.ActivityAttachment);
db.ActivityAttachment.belongsTo(db.Activity);

// DailyProduction ilişkileri
db.Plant.hasMany(db.DailyProduction, { foreignKey: "plant_id" });
db.DailyProduction.belongsTo(db.Plant, { foreignKey: "plant_id", as: "Plant" });

// PVSystReport ilişkileri
db.Plant.hasMany(db.PVSystReport, { foreignKey: "plant_id" });
db.PVSystReport.belongsTo(db.Plant, {
  foreignKey: "plant_id",
  as: "Plant",
});

module.exports = db;
