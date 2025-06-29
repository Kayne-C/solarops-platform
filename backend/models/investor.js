module.exports = (sequelize, DataTypes) => {
  const Investor = sequelize.define(
    "Investor",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      company_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      contact_person: DataTypes.STRING(100),
      email: DataTypes.STRING(255),
      phone: DataTypes.STRING(20),
      address: DataTypes.TEXT,
    },
    {
      tableName: "investors",
      underscored: true,
      timestamps: true,
    }
  );
  return Investor;
};
