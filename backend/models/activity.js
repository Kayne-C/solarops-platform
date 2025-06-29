module.exports = (sequelize, DataTypes) => {
  const Activity = sequelize.define(
    "Activity",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      work_order_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "work_orders",
          key: "id",
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      tableName: "activities",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  Activity.associate = (models) => {
    Activity.belongsTo(models.WorkOrder, {
      foreignKey: "work_order_id",
      as: "WorkOrder",
    });
    Activity.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "User",
    });
    Activity.hasMany(models.ActivityAttachment, {
      foreignKey: "activity_id",
      as: "ActivityAttachments",
    });
  };

  return Activity;
};
