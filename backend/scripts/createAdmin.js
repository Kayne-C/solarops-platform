// backend/scripts/createAdmin.js
const bcrypt = require("bcryptjs");
const { User } = require("../models");

async function createAdmin() {
  try {
    // Admin şifresini hash'le
    const adminPassword = await bcrypt.hash("admin", 10);

    // Admin kullanıcısını oluştur
    const adminUser = await User.create({
      username: "admin",
      email: "admin@egesa.com",
      password_hash: adminPassword,
      role: "ADMIN",
      phone: "555-0001",
    });

    console.log("✅ Admin kullanıcısı başarıyla oluşturuldu!");
    console.log("📋 Giriş bilgileri:");
    console.log("   Username: admin");
    console.log("   Password: admin");
    console.log("   Role: ADMIN");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      console.log("⚠️  Admin kullanıcısı zaten mevcut!");
      console.log("📋 Mevcut giriş bilgileri:");
      console.log("   Username: admin");
      console.log("   Password: admin");
    } else {
      console.error("❌ Hata:", error.message);
    }
  }
}

createAdmin();
