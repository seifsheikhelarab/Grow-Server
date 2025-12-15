import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting seed...");

    // 1. Clean up existing data (optional, but good for idempotent runs if we delete everything)
    // For now, we'll just rely on unique constraints throwing errors or upserts.
    // However, to ensure a clean slate, let's delete in reverse order of dependencies.
    await prisma.auditLog.deleteMany();
    await prisma.systemSetting.deleteMany();
    await prisma.otp.deleteMany();
    await prisma.goal.deleteMany();
    await prisma.kioskDue.deleteMany();
    await prisma.redemptionRequest.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.workerProfile.deleteMany();
    await prisma.kiosk.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.shadowWallet.deleteMany();
    await prisma.user.deleteMany();

    console.log("Cleaned up database.");

    const passwordHash = await bcrypt.hash("password123", 10);

    // 2. Create System Settings
    await prisma.systemSetting.createMany({
        data: [
            { key: "commission_rate", value: "5", description: "Default commission points per transaction" },
            { key: "min_redemption", value: "50", description: "Minimum points for redemption" },
            { key: "max_daily_tx", value: "1000", description: "Maximum daily transaction amount per user" },
            { key: "maintenance_mode", value: "false", description: "System maintenance mode status" },
        ]
    });
    console.log("System settings created.");

    // 3. Create Admins
    // Super Admin
    await prisma.user.create({
        data: {
            full_name: "Super Admin User",
            phone: "01000000000",
            password_hash: passwordHash,
            role: "ADMIN",
            admin_role: "SUPER_ADMIN",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 0 } }
        }
    });

    // Editor Admin
    await prisma.user.create({
        data: {
            full_name: "Editor Admin User",
            phone: "01000000001",
            password_hash: passwordHash,
            role: "ADMIN",
            admin_role: "EDITOR",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 0 } }
        }
    });

    // Viewer Admin
    const viewerAdmin = await prisma.user.create({
        data: {
            full_name: "Viewer Admin User",
            phone: "01000000002",
            password_hash: passwordHash,
            role: "ADMIN",
            admin_role: "VIEWER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 0 } }
        }
    });
    console.log("Admins created.");

    // 4. Create Owners
    const owner1 = await prisma.user.create({
        data: {
            full_name: "Ahmed Owner",
            phone: "01100000000",
            password_hash: passwordHash,
            role: "OWNER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 5000 } }
        }
    });

    const owner2 = await prisma.user.create({
        data: {
            full_name: "Mohamed Owner",
            phone: "01100000001",
            password_hash: passwordHash,
            role: "OWNER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 10000 } }
        }
    });
    console.log("Owners created.");

    // 5. Create Kiosks
    const kiosk1 = await prisma.kiosk.create({
        data: {
            name: "Downtown Market",
            kiosk_type: "Supermarket",
            location: "Cairo, Downtown",
            owner_id: owner1.id
        }
    });

    const kiosk2 = await prisma.kiosk.create({
        data: {
            name: "Alexandria Station",
            kiosk_type: "Pharmacy",
            location: "Alexandria",
            owner_id: owner2.id
        }
    });
    console.log("Kiosks created.");

    // 6. Create Workers
    const worker1 = await prisma.user.create({
        data: {
            full_name: "Sayed Worker",
            phone: "01200000000",
            password_hash: passwordHash,
            role: "WORKER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 500 } },
            worker_profile: {
                create: {
                    kiosk_id: kiosk1.id,
                    status: "ACTIVE",
                    position: "Manager",
                    working_hours: "8:00 AM - 5:00 PM"
                }
            }
        }
    });

    const worker2 = await prisma.user.create({
        data: {
            full_name: "Ali Worker",
            phone: "01200000001",
            password_hash: passwordHash,
            role: "WORKER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 200 } },
            worker_profile: {
                create: {
                    kiosk_id: kiosk1.id, // Same kiosk as worker1
                    status: "ACTIVE",
                    position: "Helper",
                    working_hours: "8:00 AM - 5:00 PM"
                }
            }
        }
    });

    await prisma.user.create({
        data: {
            full_name: "Pending Worker",
            phone: "01200000002",
            // No password hash yet as they are invited
            role: "WORKER",
            is_active: true,
            is_verified: false,
            wallet: { create: { balance: 0 } },
            worker_profile: {
                create: {
                    kiosk_id: kiosk2.id,
                    status: "PENDING_INVITE",
                    position: "Worker",
                    working_hours: "8:00 AM - 5:00 PM"
                }
            }
        }
    });
    console.log("Workers created.");

    // 7. Create Customers
    const customer1 = await prisma.user.create({
        data: {
            full_name: "Fatma Customer",
            phone: "01500000000",
            password_hash: passwordHash,
            role: "CUSTOMER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 150 } },
            goals: {
                create: {
                    title: "New Bike",
                    target_amount: 1000,
                    current_amount: 100,
                    type: "SAVING"
                }
            }
        }
    });

    const customer2 = await prisma.user.create({
        data: {
            full_name: "Mona Customer",
            phone: "01500000001",
            password_hash: passwordHash,
            role: "CUSTOMER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 50 } }
        }
    });
    console.log("Customers created.");

    // 8. Create Transactions
    // Deposit: Worker1 -> Customer1
    await prisma.transaction.create({
        data: {
            sender_id: worker1.id,
            receiver_phone: customer1.phone!,
            receiver_id: customer1.id,
            kiosk_id: kiosk1.id,
            amount_gross: 100,
            amount_net: 100,
            commission: 5,
            type: "DEPOSIT",
            status: "COMPLETED"
        }
    });

    // Withdrawal: Customer2 -> Worker1 (Customer cashing out at kiosk)
    await prisma.transaction.create({
        data: {
            sender_id: customer2.id,
            receiver_phone: worker1.phone!,
            receiver_id: worker1.id,
            kiosk_id: kiosk1.id,
            amount_gross: 50,
            amount_net: 50,
            commission: 0,
            type: "WITHDRAWAL",
            status: "COMPLETED"
        }
    });

    // Failed Transaction
    await prisma.transaction.create({
        data: {
            sender_id: worker2.id,
            receiver_phone: customer2.phone!,
            receiver_id: customer2.id,
            kiosk_id: kiosk1.id,
            amount_gross: 200,
            amount_net: 200,
            commission: 10,
            type: "DEPOSIT",
            status: "FAILED"
        }
    });
    console.log("Transactions created.");

    // 9. Create Redemption Requests
    await prisma.redemptionRequest.create({
        data: {
            user_id: customer1.id,
            amount: 50,
            method: "Vodafone Cash",
            details: "01500000000",
            status: "PENDING"
        }
    });

    await prisma.redemptionRequest.create({
        data: {
            user_id: worker1.id,
            amount: 100,
            method: "Instapay",
            details: "worker1@instapay",
            status: "COMPLETED",
            admin_note: "Processed via Dashboard"
        }
    });
    console.log("Redemption requests created.");

    // 10. Create Kiosk Dues
    await prisma.kioskDue.create({
        data: {
            kiosk_id: kiosk1.id,
            amount: 500,
            is_paid: false
        }
    });

    await prisma.kioskDue.create({
        data: {
            kiosk_id: kiosk1.id,
            amount: 200,
            is_paid: true,
            collected_by: viewerAdmin.id // Just for example
        }
    });
    console.log("Kiosk dues created.");

    // 11. Create Audit Logs
    await prisma.auditLog.create({
        data: {
            admin_id: viewerAdmin.id, // ID of an admin
            action: "VIEW_DASHBOARD",
            details: JSON.stringify({ period: "7d" }),
            ip_address: "127.0.0.1"
        }
    });
    console.log("Audit logs created.");

    // 12. Create Shadow Wallet
    await prisma.shadowWallet.create({
        data: {
            phone: "01999999999", // Non-registered user
            balance: 25
        }
    });
    console.log("Shadow wallets created.");

    console.log("Seed completed successfully!");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
