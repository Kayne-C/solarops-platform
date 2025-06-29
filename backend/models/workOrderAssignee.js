module.exports = (sequelize, DataTypes) => {
  const WorkOrderAssignee = sequelize.define(
    "WorkOrderAssignee",
    {
      work_order_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
    },
    {
      tableName: "work_order_assignees",
      underscored: true,
      timestamps: true,
    }
  );
  return WorkOrderAssignee;
};
