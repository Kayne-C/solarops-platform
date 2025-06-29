module.exports = (sequelize, DataTypes) => {
  const WorkOrder = sequelize.define(
    "WorkOrder",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      description: DataTypes.TEXT,
      plant_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [["MAINTENANCE", "FAULT", "INSPECTION", "OTHER"]],
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "PENDING",
        validate: {
          isIn: [["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]],
        },
      },
      priority: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [["LOW", "MEDIUM", "HIGH", "URGENT"]],
        },
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "work_orders",
      underscored: true,
      timestamps: true,
    }
  );

  WorkOrder.associate = (models) => {
    WorkOrder.hasMany(models.Activity, {
      foreignKey: "work_order_id",
      as: "Activities",
    });
  };

  return WorkOrder;
};
