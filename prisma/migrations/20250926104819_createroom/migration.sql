-- AlterEnum
ALTER TYPE "PlayerStatus" ADD VALUE 'QUIT';

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'WAITING';
