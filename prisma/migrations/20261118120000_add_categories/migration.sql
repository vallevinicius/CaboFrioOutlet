-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `intro` VARCHAR(500) NOT NULL DEFAULT '',
    `description` VARCHAR(500) NOT NULL DEFAULT '',
    `image` VARCHAR(191) NOT NULL DEFAULT '',
    `order` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_key_key`(`key`),
    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- As quatro categorias que eram fixas no código. As keys (com acento) são as que os produtos
-- já têm gravadas em Product.category; os slugs mantêm os endereços já indexados.
INSERT INTO `Category` (`id`, `key`, `slug`, `name`, `intro`, `description`, `image`, `order`, `active`, `updatedAt`) VALUES
  ('cat_camisas', 'camisas', 'camisas', 'Camisas',
   'Camisetas básicas, oversized e estampadas para montar o look do dia.',
   'Camisas e camisetas multimarcas em Cabo Frio: básicas, oversized e estampadas, com preço de outlet.',
   '/placeholders/cat-camisas.jpg', 0, true, CURRENT_TIMESTAMP(3)),
  ('cat_calcas', 'calças', 'calcas', 'Calças',
   'Calças para todo estilo: jeans, sarja e modelos urbanos.',
   'Calças jeans, de sarja e modelos urbanos multimarcas em Cabo Frio, com preço de outlet.',
   '/placeholders/cat-calcas.jpg', 1, true, CURRENT_TIMESTAMP(3)),
  ('cat_bermudas', 'bermudas', 'bermudas', 'Bermudas',
   'Bermudas confortáveis e com atitude para o dia a dia.',
   'Bermudas urbanas e confortáveis multimarcas em Cabo Frio, com preço de outlet.',
   '/placeholders/cat-bermudas.jpg', 2, true, CURRENT_TIMESTAMP(3)),
  ('cat_bones', 'bonés', 'bones', 'Bonés',
   'Bonés de aba curva, aba reta e trucker para fechar o visual.',
   'Bonés multimarcas de aba curva, aba reta e trucker em Cabo Frio, com preço de outlet.',
   '/placeholders/cat-bones.jpg', 3, true, CURRENT_TIMESTAMP(3));
