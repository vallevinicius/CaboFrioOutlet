-- AlterTable
ALTER TABLE `User` ADD COLUMN `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `roleId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `level` ENUM('VIEW', 'EDIT') NOT NULL,

    PRIMARY KEY (`roleId`, `section`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_roleId_idx` ON `User`(`roleId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Dados: perfil de sistema "Administrador" (editar em tudo) para os admins que já existem.
-- O admin supremo NÃO é definido aqui: quem marca é o `npm run db:seed` (ADMIN_EMAIL).
INSERT INTO `Role` (`id`, `name`, `system`) VALUES ('role-administrador', 'Administrador', true);

INSERT INTO `RolePermission` (`roleId`, `section`, `level`) VALUES
    ('role-administrador', 'inicio', 'EDIT'),
    ('role-administrador', 'banners', 'EDIT'),
    ('role-administrador', 'produtos', 'EDIT'),
    ('role-administrador', 'estoque', 'EDIT'),
    ('role-administrador', 'pedidos', 'EDIT'),
    ('role-administrador', 'atacado', 'EDIT'),
    ('role-administrador', 'clientes', 'EDIT'),
    ('role-administrador', 'configuracoes', 'EDIT');

UPDATE `User` SET `roleId` = 'role-administrador' WHERE `isAdmin` = true;
