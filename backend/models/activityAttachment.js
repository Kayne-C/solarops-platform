module.exports = (sequelize, DataTypes) => {
  const ActivityAttachment = sequelize.define(
    "ActivityAttachment",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      activity_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      file_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      file_path: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      file_type: DataTypes.STRING(50),
      file_size: DataTypes.BIGINT,
    },
    {
      tableName: "activity_attachments",
      underscored: true,
      timestamps: false,
    }
  );
  return ActivityAttachment;
};
