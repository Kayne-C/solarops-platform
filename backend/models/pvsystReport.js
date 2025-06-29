const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PVSystReport = sequelize.define(
    "PVSystReport",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      plant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "plants",
          key: "id",
        },
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 2000,
          max: 2100,
        },
      },
      month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 12,
        },
      },
      expected_production: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      is_calculated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "pvsyst_reports",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ["plant_id", "year", "month"],
        },
        {
          fields: ["is_calculated"],
        },
      ],
    }
  );

  PVSystReport.associate = (models) => {
    PVSystReport.belongsTo(models.Plant, {
      foreignKey: "plant_id",
      as: "Plant",
    });
  };

  return PVSystReport;
};
