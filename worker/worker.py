import json
import logging
import os
import time

import pika
import requests


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
)
logger = logging.getLogger(__name__)

RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@rabbitmq:5672/')
MICRO_INGESTION_URL = os.getenv('MICRO_INGESTION_URL', 'http://ingestion-service:8001').rstrip('/')
MICRO_INDEXING_URL = os.getenv('MICRO_INDEXING_URL', 'http://indexing-service:8002').rstrip('/')

def process_message(body: bytes) -> None:
    payload = json.loads(body.decode('utf-8'))
    filename = payload['filename']
    content_b64 = payload['content_b64']

    ingest_resp = requests.post(
        f'{MICRO_INGESTION_URL}/ingest',
        json={'filename': filename, 'content_b64': content_b64},
        timeout=180,
    )
    ingest_resp.raise_for_status()
    chunks = ingest_resp.json().get('chunks', [])

    index_resp = requests.post(
        f'{MICRO_INDEXING_URL}/index/upsert',
        json={'chunks': chunks},
        timeout=180,
    )
    index_resp.raise_for_status()


def run() -> None:
    while True:
        connection = None
        try:
            logger.info('Connexion à RabbitMQ...')
            connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
            channel = connection.channel()
            channel.queue_declare(queue='upload_queue', durable=True)
            channel.basic_qos(prefetch_count=1)

            def callback(ch, method, _properties, body):
                try:
                    process_message(body)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    logger.info('Message traité avec succès.')
                except Exception:
                    logger.exception('Échec du traitement du message.')
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

            channel.basic_consume(queue='upload_queue', on_message_callback=callback)
            logger.info('Worker démarré, en attente de messages...')
            channel.start_consuming()
        except Exception:
            logger.exception('Connexion perdue, nouvelle tentative dans 5 secondes.')
            time.sleep(5)
        finally:
            try:
                if connection and connection.is_open:
                    connection.close()
            except Exception:
                pass


if __name__ == '__main__':
    run()
