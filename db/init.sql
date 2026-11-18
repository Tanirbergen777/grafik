-- Сброс таблиц и представлений (на случай перезапуска)
DROP VIEW IF EXISTS v_hr_monthly_analytics;
DROP TABLE IF EXISTS request_history CASCADE;
DROP TABLE IF EXISTS request_periods CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS hr_batches CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS divisions CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS seniority_leave_rules CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS request_statuses CASCADE;

-- 1. Справочник ролей
CREATE TABLE roles (
                       id SERIAL PRIMARY KEY,
                       code VARCHAR(50) NOT NULL UNIQUE,
                       name VARCHAR(100) NOT NULL
);

-- 2. Справочник должностей
CREATE TABLE positions (
                           id SERIAL PRIMARY KEY,
                           title VARCHAR(150) NOT NULL UNIQUE,
                           created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Справочник статусов заявки
CREATE TABLE request_statuses (
                                  id SERIAL PRIMARY KEY,
                                  code VARCHAR(30) NOT NULL UNIQUE,
                                  name VARCHAR(100) NOT NULL
);

-- 4. Правила расчета дней отпуска по выслуге лет (Закон РК)
CREATE TABLE seniority_leave_rules (
                                       id SERIAL PRIMARY KEY,
                                       min_years INT NOT NULL,
                                       max_years INT, -- NULL означает "и более"
                                       base_days INT NOT NULL DEFAULT 30,
                                       additional_days INT NOT NULL DEFAULT 0,
                                       CHECK (min_years >= 0)
);

-- 5. Департаменты
CREATE TABLE departments (
                             id SERIAL PRIMARY KEY,
                             name VARCHAR(150) NOT NULL UNIQUE,
                             head_id INT,
                             created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
select * from departments;

-- 6. Управления внутри департаментов
CREATE TABLE divisions (
                           id SERIAL PRIMARY KEY,
                           department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                           name VARCHAR(150) NOT NULL,
                           head_id INT,
                           created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                           UNIQUE (department_id, name)
);

-- 7. Пользователи (Сотрудники, Начальники, Кадровики, Бухгалтеры + поля для Демо 1С)
CREATE TABLE users (
                       id SERIAL PRIMARY KEY,
                       external_1c_id VARCHAR(50) UNIQUE,
                       last_name VARCHAR(50) NOT NULL,
                       first_name VARCHAR(50) NOT NULL,
                       middle_name VARCHAR(50),
                       role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                       position_id INT REFERENCES positions(id) ON DELETE SET NULL,
                       department_id INT REFERENCES departments(id) ON DELETE SET NULL,
                       division_id INT REFERENCES divisions(id) ON DELETE SET NULL,
                       service_years INT NOT NULL DEFAULT 0 CHECK (service_years >= 0),
                       is_active BOOLEAN NOT NULL DEFAULT TRUE,
                       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head
        FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE SET NULL;

rollback;
ALTER TABLE divisions
    ADD CONSTRAINT fk_divisions_head
        FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE SET NULL;

-- 8. Справочник праздничных дней (управляется Кадровиком на каждый год)
CREATE TABLE holidays (
                          id SERIAL PRIMARY KEY,
                          holiday_date DATE NOT NULL UNIQUE,
                          year INT NOT NULL,
                          name VARCHAR(150) NOT NULL,
                          created_by INT REFERENCES users(id) ON DELETE SET NULL,
                          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Пакеты (Excel-выгрузки), которые Кадровик формирует по департаментам для Бухгалтера
CREATE TABLE hr_batches (
                            id SERIAL PRIMARY KEY,
                            batch_number VARCHAR(50) NOT NULL UNIQUE,
                            department_id INT REFERENCES departments(id) ON DELETE SET NULL,
                            division_id INT REFERENCES divisions(id) ON DELETE SET NULL,
                            target_year INT NOT NULL,
                            created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                            sent_to_accountant_id INT REFERENCES users(id) ON DELETE SET NULL,
                            excel_file_path TEXT,
                            status VARCHAR(30) NOT NULL DEFAULT 'SENT_TO_ACCOUNTING' CHECK (
                                status IN ('GENERATED', 'SENT_TO_ACCOUNTING', 'PROCESSED')
                                ),
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE hr_batches ADD COLUMN is_processed BOOLEAN DEFAULT false;
ALTER TABLE hr_batches ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE hr_batches ADD COLUMN processed_by INT REFERENCES users(id);

-- 10. Заявки сотрудников на отпуск (шапка заявки в 3НФ)
CREATE TABLE requests (
                          id SERIAL PRIMARY KEY,
                          request_number VARCHAR(50) NOT NULL UNIQUE,
                          employee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                          division_id INT NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
                          status_id INT NOT NULL REFERENCES request_statuses(id) ON DELETE RESTRICT,

                          target_year INT NOT NULL,
                          total_allowed_days INT NOT NULL CHECK (total_allowed_days IN (30, 35, 40, 45)),

                          current_stage VARCHAR(30) NOT NULL DEFAULT 'EMPLOYEE' CHECK (
                              current_stage IN ('EMPLOYEE', 'DIVISION_HEAD', 'DEPARTMENT_HEAD', 'HR', 'ACCOUNTING')
                              ),

                          revision_comment TEXT,
                          batch_id INT REFERENCES hr_batches(id) ON DELETE SET NULL,

                          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                          UNIQUE (employee_id, target_year)
);

-- 11. Периоды отпуска внутри заявки (до 2 частей в год с учетом праздничных дней)
CREATE TABLE request_periods (
                                 id SERIAL PRIMARY KEY,
                                 request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
                                 part_number SMALLINT NOT NULL CHECK (part_number IN (1, 2)),
                                 start_date DATE NOT NULL,
                                 end_date DATE NOT NULL,          -- Итоговая дата окончания с учетом сдвига из-за праздников
                                 vacation_days INT NOT NULL CHECK (vacation_days > 0), -- Оплачиваемые дни отпуска (например, 14)
                                 holidays_count INT NOT NULL DEFAULT 0 CHECK (holidays_count >= 0), -- Сколько праздников попало внутрь (например, 1)
                                 substitute_user_id INT REFERENCES users(id) ON DELETE SET NULL,
                                 CHECK (end_date >= start_date),
                                 UNIQUE (request_id, part_number)
);

-- 12. История согласований заявки
CREATE TABLE request_history (
                                 id SERIAL PRIMARY KEY,
                                 request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
                                 acted_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                                 from_status_id INT REFERENCES request_statuses(id),
                                 to_status_id INT NOT NULL REFERENCES request_statuses(id),
                                 stage VARCHAR(30) NOT NULL,
                                 comment TEXT,
                                 created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE VIEW v_hr_monthly_analytics AS
SELECT
    EXTRACT(YEAR FROM rp.start_date)::INT AS vacation_year,
    EXTRACT(MONTH FROM rp.start_date)::INT AS vacation_month,
    d.id AS department_id,
    d.name AS department_name,
    div.id AS division_id,
    div.name AS division_name,
    u.id AS employee_id,
    u.last_name || ' ' || u.first_name || COALESCE(' ' || u.middle_name, '') AS full_name,
    p.title AS position_title,
    rp.part_number,
    rp.start_date,
    rp.end_date,
    rp.vacation_days,
    rp.holidays_count,
    rs.code AS status_code
FROM request_periods rp
         JOIN requests r ON r.id = rp.request_id
         JOIN request_statuses rs ON rs.id = r.status_id
         JOIN users u ON u.id = r.employee_id
         JOIN divisions div ON div.id = r.division_id
         JOIN departments d ON d.id = div.department_id
         LEFT JOIN positions p ON p.id = u.position_id;

CREATE INDEX idx_divisions_department ON divisions(department_id);
CREATE INDEX idx_users_department_division ON users(department_id, division_id);
CREATE INDEX idx_requests_division_year ON requests(division_id, target_year);
CREATE INDEX idx_requests_status_stage ON requests(status_id, current_stage);
CREATE INDEX idx_requests_batch ON requests(batch_id);
CREATE INDEX idx_request_periods_dates ON request_periods(start_date, end_date);
CREATE INDEX idx_holidays_year_date ON holidays(year, holiday_date);

INSERT INTO roles (code, name) VALUES
                                   ('EMPLOYEE', 'Сотрудник'),
                                   ('DIVISION_HEAD', 'Начальник управления'),
                                   ('DEPARTMENT_HEAD', 'Начальник департамента'),
                                   ('HR', 'Кадровик'),
                                   ('ACCOUNTANT', 'Бухгалтер'),
                                   ('ADMIN', 'Администратор (Демо 1С)');

INSERT INTO roles (code,name) VALUES
                                  ('DEPT_DEPUTY' , 'Заместитель департамента')
ON CONFLICT (code) DO NOTHING;

select * from roles;

select * from roles;

UPDATE roles
SET name = '1С'
WHERE code = 'ADMIN';
SELECT * FROM roles
WHERE code = 'ADMIN';
-- Базовые данные: Статусы
INSERT INTO request_statuses (code, name) VALUES
                                              ('DRAFT', 'Черновик'),
                                              ('SENT', 'Отправлен'),
                                              ('REVISION', 'Доработка'),
                                              ('APPROVED', 'Утвержден'),
                                              ('REJECTED', 'Отказано');

-- Базовые данные: Выслуга лет по Закону РК
INSERT INTO seniority_leave_rules (min_years, max_years, base_days, additional_days) VALUES
                                                                                         (0, 9, 30, 0),
                                                                                         (10, 14, 30, 5),
                                                                                         (15, 19, 30, 10),
                                                                                         (20, NULL, 30, 15);

BEGIN;

rollback;
select * from regions;
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    is_central BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO regions(id,name,is_central) VALUES
                                            (1,'Центральный Аппарат',true),
                                            (2,'ДЭР Астана',false),
                                            (3,'Дэр Алматы', false)
ON CONFLICT (id) DO NOTHING;

SELECT * FROM regions;

ALTER TABLE departments ADD COLUMN region_id INT REFERENCES regions(id) ON DELETE RESTRICT;
ROLLBACK;

UPDATE departments SET region_id = 1 WHERE region_id IS NULL;
select * from departments;
ALTER TABLE departments ALTER COLUMN region_id SET NOT NULL;
ALTER TABLE departments ADD COLUMN type_code VARCHAR(50);

UPDATE departments SET type_code = 'HR' WHERE id = 2;
UPDATE departments SET type_code = 'OPER' WHERE id = 1;
UPDATE departments SET type_code = 'BUG' WHERE id = 3;

SELECT * FROM departments;

ROLLBACK;

ALTER TABLE requests ADD COLUMN target_hr_id INT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE requests DROP COLUMN target_hr_id;
SELECT * FROM requests;
ROLLBACK;


COMMIT;


-------------------------------------------------------------------------
BEGIN;

-- ============================================================================
-- 0. ПОДГОТОВКА СХЕМЫ И СПРАВОЧНИКОВ (Роли, Должности, Ограничения)
-- ============================================================================

    rollback ;
-- Разрешаем одинаковые названия департаментов в РАЗНЫХ регионах (ЦА, Астана, Алматы)
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
select * from departments;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS uq_departments_region_name;
ALTER TABLE departments ADD CONSTRAINT uq_departments_region_name UNIQUE (region_id, name);
rollback;
-- Поле для маршрутизации заявки конкретному кадровику (ЦА или своего ДЭР)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_hr_id INT REFERENCES users(id) ON DELETE SET NULL;

-- Проверяем наличие всех 8 ролей строго по порядку ID
INSERT INTO roles (id, code, name) VALUES
                                       (1, 'EMPLOYEE', 'Сотрудник'),
                                       (2, 'DIVISION_HEAD', 'Начальник управления'),
                                       (3, 'DEPARTMENT_HEAD', 'Начальник департамента'),
                                       (4, 'HR', 'Кадровик'),
                                       (5, 'ACCOUNTANT', 'Бухгалтер'),
                                       (6, 'ADMIN', '1С'),
                                       (7, 'DEPT_DEPUTY', 'Заместитель начальника департамента'),
                                       (8, 'DIV_DEPUTY', 'Заместитель начальника управления')
ON CONFLICT (code) DO NOTHING;
select * from roles;

-- Добавляем недостающие должности по порядку (1..7 у тебя уже есть, добавляем 8 и 9)
INSERT INTO positions (id, title) VALUES
                                      (8, 'Заместитель начальника департамента'),
                                      (9, 'Заместитель начальника управления')
ON CONFLICT (id) DO NOTHING;

-- Удаляем незаконченные тестовые строки (13, 14), если они успели вставиться ранее
DELETE FROM users WHERE id >= 13;
DELETE FROM divisions WHERE id >= 6;
DELETE FROM departments WHERE id >= 4;



INSERT INTO departments (id, name, head_id, type_code, region_id) VALUES
                                                                      -- ДЭР Астана (region_id = 2): 3 департамента
                                                                      (4, 'Департамент кадровой работы', NULL, 'HR', 2),
                                                                      (5, 'Департамент стратегии и оперативного управления', NULL, 'OPER', 2),
                                                                      (6, 'Административный департамент', NULL, 'BUG', 2),

                                                                      -- ДЭР Алматы (region_id = 3): 3 департамента
                                                                      (7, 'Департамент кадровой работы', NULL, 'HR', 3),
                                                                      (8, 'Департамент стратегии и оперативного управления', NULL, 'OPER', 3),
                                                                      (9, 'Административный департамент', NULL, 'BUG', 3);



INSERT INTO divisions (id, department_id, name, head_id) VALUES
                                                             -- Управления ДЭР Астана (департаменты 4, 5, 6)
                                                             (6,  4, 'Управление кадровой работы', NULL),
                                                             (7,  4, 'Управление кадрового развития', NULL),
                                                             (8,  5, 'Стратегическое планирование и проектное управление', NULL),
                                                             (9,  5, 'Организационно-контрольная работа', NULL),
                                                             (10, 6, 'Управление бюджетного планирования', NULL),

                                                             -- Управления ДЭР Алматы (департаменты 7, 8, 9)
                                                             (11, 7, 'Управление кадровой работы', NULL),
                                                             (12, 7, 'Управление кадрового развития', NULL),
                                                             (13, 8, 'Стратегическое планирование и проектное управление', NULL),
                                                             (14, 8, 'Организационно-контрольная работа', NULL),
                                                             (15, 9, 'Управление бюджетного планирования', NULL);


INSERT INTO users (id, external_1c_id, last_name, first_name, middle_name, role_id, position_id, department_id, division_id, service_years) VALUES
                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                -- Дополняем Центральный Аппарат (ЦА) заместителями департаментов (для полноты)
                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                (13, '1C-013', 'Ахметов', 'Серик', 'Болатович', 7, 8, 1, NULL, 18),      -- Зам. нач. Оперативного деп. ЦА
                                                                                                                                                (15, '1C-015', 'Сулейменов', 'Тимур', 'Аскарович', 3, 3, 3, NULL, 21),   -- Нач. Административного деп. ЦА

                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                -- ДЭР АСТАНА (region_id = 2)
                                                                                                                                                -- Департамент 4: Департамент кадровой работы (управления 6 и 7)
                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                (16, '1C-016', 'Бақыт', 'Даурен', 'Каренұлы', 3, 3, 4, NULL, 17),        -- Начальник деп. кадров (ДЭР Астана)
                                                                                                                                                (17, '1C-017', 'Жарас', 'Талғат', 'Омарұлы', 7, 8, 4, NULL, 14),         -- Зам. начальника деп. кадров (ДЭР Астана)
                                                                                                                                                (18, '1C-018', 'Омарова', 'Динара', 'Руслановна', 2, 2, 4, 6, 11),       -- Нач. упр. кадровой работы (div=6)
                                                                                                                                                (19, '1C-019', 'Садыкова', 'Айжан', 'Маратовна', 4, 7, 4, 6, 7),         -- КАДРОВИК ДЭР Астана (div=6)
                                                                                                                                                (20, '1C-020', 'Алиев', 'Нурлан', 'Серикович', 1, 7, 4, 6, 4),           -- Сотрудник упр. кадровой работы (div=6)
                                                                                                                                                (21, '1C-021', 'Калиев', 'Ержан', 'Бауыржанович', 2, 2, 4, 7, 12),       -- Нач. упр. кадрового развития (div=7)
                                                                                                                                                (22, '1C-022', 'Мусина', 'Алия', 'Талгатовна', 1, 7, 4, 7, 5),           -- Сотрудник упр. кадрового развития (div=7)

                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                -- ДЭР АСТАНА (region_id = 2)
                                                                                                                                                -- Департамент 5: Департамент стратегии и опер. управления (управления 8 и 9)
                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                (23, '1C-023', 'Нургалиев', 'Азамат', 'Серикович', 3, 3, 5, NULL, 19),   -- Начальник деп. стратегии (ДЭР Астана)
                                                                                                                                                (24, '1C-024', 'Ким', 'Евгений', 'Александрович', 7, 8, 5, NULL, 15),    -- Зам. начальника деп. стратегии (ДЭР Астана)
                                                                                                                                                (25, '1C-025', 'Махмутов', 'Ильяс', 'Канатович', 2, 2, 5, 8, 10),        -- Нач. упр. стратег. планирования (div=8)
                                                                                                                                                (26, '1C-026', 'Берикулы', 'Санжар', 'Арманович', 1, 1, 5, 8, 3),        -- Сотрудник упр. стратег. планирования (div=8)
                                                                                                                                                (27, '1C-027', 'Досов', 'Рустам', 'Ерланович', 2, 2, 5, 9, 13),          -- Нач. упр. орг-контрольной работы (div=9)
                                                                                                                                                (28, '1C-028', 'Тажибаева', 'Гульназ', 'Аسхатовна', 1, 4, 5, 9, 6),      -- Сотрудник упр. орг-контрольной работы (div=9)

                                                                                                                                                -- Бухгалтер ДЭР Астана (Департамент 6, Управление 10)
                                                                                                                                                (29, '1C-029', 'Смагулова', 'Жанна', 'Ерболовна', 5, 5, 6, 10, 8),       -- Бухгалтер ДЭР Астана

                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                -- ДЭР АЛМАТЫ (region_id = 3)
                                                                                                                                                -- Департамент 7: Департамент кадровой работы (управления 11 и 12)
                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                (30, '1C-030', 'Аبдрахманов', 'Канат', 'Жумабаевич', 3, 3, 7, NULL, 20), -- Начальник деп. кадров (ДЭР Алматы)
                                                                                                                                                (31, '1C-031', 'Сейтов', 'Данияр', 'Муратович', 7, 8, 7, NULL, 14),      -- Зам. начальника деп. кадров (ДЭР Алматы)
                                                                                                                                                (32, '1C-032', 'Жумабаева', 'Сауле', 'Кайратовна', 2, 2, 7, 11, 10),     -- Нач. упр. кадровой работы (div=11)
                                                                                                                                                (33, '1C-033', 'Ибраева', 'Мадина', 'Сериковна', 4, 7, 7, 11, 6),        -- КАДРОВИК ДЭР Алматы (div=11)
                                                                                                                                                (34, '1C-034', 'Кожахметов', 'Арман', 'Берикович', 2, 2, 7, 12, 11),     -- Нач. упр. кадрового развития (div=12)

                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                -- ДЭР АЛМАТЫ (region_id = 3)
                                                                                                                                                -- Департамент 8: Департамент стратегии и опер. управления (управления 13 и 14)
                                                                                                                                                -- ------------------------------------------------------------------------
                                                                                                                                                (35, '1C-035', 'Оспанов', 'Бауыржан', 'Тимурович', 3, 3, 8, NULL, 22),   -- Начальник деп. стратегии (ДЭР Алматы)
                                                                                                                                                (36, '1C-036', 'Ашимов', 'Олжас', 'Ержанович', 7, 8, 8, NULL, 16),       -- Зам. начальника деп. стратегии (ДЭР Алматы)
                                                                                                                                                (37, '1C-037', 'Шарипов', 'Айдар', 'Нурланович', 2, 2, 8, 13, 9),        -- Нач. упр. стратег. планирования (div=13)
                                                                                                                                                (38, '1C-038', 'Ермеков', 'Диас', 'Саматович', 1, 1, 8, 13, 4),          -- Сотрудник упр. стратег. планирования (div=13)
                                                                                                                                                (39, '1C-039', 'Куанышев', 'Мирас', 'Алмасович', 2, 2, 8, 14, 12),       -- Нач. упр. орг-контрольной работы (div=14)

                                                                                                                                                -- Бухгалтер ДЭР Алматы (Департамент 9, Управление 15)
                                                                                                                                                (40, '1C-040', 'Болатова', 'Асем', 'Дауреновна', 5, 5, 9, 15, 7);        -- Бухгалтер ДЭР Алматы


-- ============================================================================
-- 4. ПРОСТАВЛЯЕМ ВСЕХ НАЧАЛЬНИКОВ (head_id) В DEPARTMENTS И DIVISIONS
-- ============================================================================

-- Департаменты ЦА (1..3)
                                                                                                                                                                                                                         rollback;
UPDATE departments SET head_id = 3  WHERE id = 1; -- Мұхит Мархабат
UPDATE departments SET head_id = 9  WHERE id = 2; -- Турганбаев Данияр
UPDATE departments SET head_id = 15 WHERE id = 3; -- Сулейменов Тимур1
    select * from users where id = 1;
select * from departments;
-- Департаменты ДЭР Астана (4..5)
UPDATE departments SET head_id = 16 WHERE id = 4; -- Бақыт Даурен
UPDATE departments SET head_id = 23 WHERE id = 5; -- Нургалиев Азамат

-- Департаменты ДЭР Алматы (7..8)
UPDATE departments SET head_id = 30 WHERE id = 7; -- Абдрахманов Канат
UPDATE departments SET head_id = 35 WHERE id = 8; -- Оспанов Бауыржан

-- Управления ЦА (1..5) — у тебя был заполнен только id=1, заполняем все!
UPDATE divisions SET head_id = 2  WHERE id = 1; -- Нұрсұлтан Ардақ
UPDATE divisions SET head_id = 7  WHERE id = 2; -- Қасен Диас
UPDATE divisions SET head_id = 12 WHERE id = 5; -- Парменова Айгерим
select * from divisions;
select * from users;
rollback ;
-- Управления ДЭР Астана (6..9)
UPDATE divisions
SET head_id = 18
WHERE id = 6; -- Омарова Динара
UPDATE divisions SET head_id = 21 WHERE id = 7; -- Калиев Ержан
UPDATE divisions SET head_id = 25 WHERE id = 8; -- Махмутов Ильяс
UPDATE divisions SET head_id = 27 WHERE id = 9; -- Досов Рустам

-- Управления ДЭР Алматы (11..14)
UPDATE divisions SET head_id = 32 WHERE id = 11; -- Жумабаева Сауле
UPDATE divisions SET head_id = 34 WHERE id = 12; -- Кожахметов Арман
UPDATE divisions SET head_id = 37 WHERE id = 13; -- Шарипов Айдар
UPDATE divisions SET head_id = 39 WHERE id = 14; -- Куанышев Мирас


-- ============================================================================
-- 5. СИНХРОНИЗАЦИЯ СЧЕТЧИКОВ (SEQUENCES)
-- ============================================================================
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));
SELECT setval('positions_id_seq', (SELECT MAX(id) FROM positions));
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('divisions_id_seq', (SELECT MAX(id) FROM divisions));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

COMMIT;



ALTER TABLE requests ALTER COLUMN division_id DROP NOT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS department_id INT REFERENCES departments(id) ON DELETE RESTRICT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_division_checked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_department_checked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_approver_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE request_periods ADD COLUMN IF NOT EXISTS with_health_benefit BOOLEAN NOT NULL DEFAULT FALSE;

-- Изменение роли пользователя id = 10 (Жұма Ерден) на Заместителя начальника департамента (DEPT_DEPUTY) и удаление прежнего зама (id = 14)
UPDATE divisions SET head_id = NULL WHERE head_id = 10;

UPDATE users
SET role_id = (SELECT id FROM roles WHERE code = 'DEPT_DEPUTY'),
    position_id = COALESCE((SELECT id FROM positions WHERE title = 'Заместитель начальника департамента' LIMIT 1), position_id)
WHERE id = 10;

DELETE FROM users
WHERE id = 14
   OR (department_id = 2 AND id != 10 AND role_id = (SELECT id FROM roles WHERE code = 'DEPT_DEPUTY'));


select * from regions;

select * from users;