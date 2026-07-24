CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS leituras (
    time                  TIMESTAMPTZ NOT NULL,
    modo_operacao         TEXT NOT NULL,
    status_concessionaria TEXT NOT NULL,
    motor_status          TEXT NOT NULL,
    rpm                   SMALLINT NOT NULL,
    temperatura_c         SMALLINT,
    bateria_v             NUMERIC(4,1) NOT NULL,
    combustivel_pct       SMALLINT NOT NULL,
    rede_freq_hz          NUMERIC(5,2) NOT NULL,
    rede_volts_l1         NUMERIC(5,1) NOT NULL,
    rede_volts_l2         NUMERIC(5,1) NOT NULL,
    rede_volts_l3         NUMERIC(5,1) NOT NULL,
    gerador_volts_l1      NUMERIC(6,1) NOT NULL,
    gerador_volts_l2      NUMERIC(6,1) NOT NULL,
    gerador_volts_l3      NUMERIC(6,1) NOT NULL,
    gerador_amps_l1       NUMERIC(6,1) NOT NULL,
    gerador_amps_l2       NUMERIC(6,1) NOT NULL,
    gerador_amps_l3       NUMERIC(6,1) NOT NULL,
    partidas              INTEGER NOT NULL,
    energia_kwh           NUMERIC(10,1) NOT NULL,
    energia_kvarh         NUMERIC(10,1) NOT NULL,
    energia_kvah          NUMERIC(10,1) NOT NULL
);

SELECT create_hypertable('leituras', 'time');
SELECT add_retention_policy('leituras', INTERVAL '90 days');

CREATE TABLE IF NOT EXISTS falhas_coleta (
    time TIMESTAMPTZ NOT NULL,
    erro TEXT NOT NULL
);

SELECT create_hypertable('falhas_coleta', 'time');
SELECT add_retention_policy('falhas_coleta', INTERVAL '90 days');
