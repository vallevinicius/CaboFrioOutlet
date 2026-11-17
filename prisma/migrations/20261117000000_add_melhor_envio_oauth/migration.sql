-- Melhor Envio passa a usar OAuth: o token de acesso vence em 30 dias e é renovado com o token de renovação.
-- Os dois ficam cifrados pela aplicação.
ALTER TABLE `Settings` ADD COLUMN `melhorEnvioRefreshToken` TEXT NULL,
    ADD COLUMN `melhorEnvioTokenExpiresAt` DATETIME(3) NULL;
