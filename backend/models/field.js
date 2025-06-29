module.exports = (sequelize, DataTypes) => {
  const Field = sequelize.define(
    "Field",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      location: DataTypes.TEXT,
    },
    {
      tableName: "fields",
      underscored: true,
      timestamps: true,
    }
  );
  return Field;
};
