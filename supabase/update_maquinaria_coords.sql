-- Run this script in the Supabase SQL Editor if you already inserted the machinery.
-- This will update the custom_data to include the correct latitude and longitude based on the provided Google Maps links.

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/e6yNNUsgp2Z44ih19"'),
        '{latitud}', '"19.4268174"'
    ),
    '{longitud}', '"-99.191888"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/g6vNNUsgp2Z44jh19' 
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/e6yNNUsgp2Z44ih19';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/q4cnZkw5dBAmBkA97"'),
        '{latitud}', '"19.264767"'
    ),
    '{longitud}', '"-99.560948"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/g4cnZkw5dBAmbkXg7'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/q4cnZkw5dBAmBkA97';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/VTHCB9deUzWoQwER9"'),
        '{latitud}', '"20.037762"'
    ),
    '{longitud}', '"-98.80185"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/yTHCB9deUzWqQWER9'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/VTHCB9deUzWoQwER9';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/w5mywW53qZUt4kPr7"'),
        '{latitud}', '"19.5015755"'
    ),
    '{longitud}', '"-98.8968658"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/w5mywW53pZUt4tPr7'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/w5mywW53qZUt4kPr7';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/6NXGrHfCNZVUbfso9"'),
        '{latitud}', '"19.55496"'
    ),
    '{longitud}', '"-98.9124789"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/bNxtQrHfCNZVUbfw9'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/6NXGrHfCNZVUbfso9';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/GNmXFQCThZSSJRDg6"'),
        '{latitud}', '"22.476867"'
    ),
    '{longitud}', '"-97.8888356"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/gNrmXFQCThZ3SiRDg8'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/GNmXFQCThZSSJRDg6';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/boMSekT5frvcvRqF7"'),
        '{latitud}', '"25.4825756"'
    ),
    '{longitud}', '"-100.9924999"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/bqM5ekT5fnvcyRgF7'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/boMSekT5frvcvRqF7';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/WUjmGffGpamujWAQ7"'),
        '{latitud}', '"23.8503965"'
    ),
    '{longitud}', '"-104.7805431"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/WUJmGffGpamujWAQ7';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/MCGdLuvw7ojjtuda6"'),
        '{latitud}', '"19.694556"'
    ),
    '{longitud}', '"-96.454746"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/MCGdLuvw7oijtvda6'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/MCGdLuvw7ojjtuda6';

UPDATE public.maquinaria
SET custom_data = jsonb_set(
    jsonb_set(
        jsonb_set(custom_data, '{ubicacion}', '"https://maps.app.goo.gl/ETiKskuZsWXCYRKx6"'),
        '{latitud}', '"19.264767"'
    ),
    '{longitud}', '"-99.560948"'
)
WHERE custom_data->>'ubicacion' = 'https://maps.app.goo.gl/ETiKszuZwWXCYRKx5'
   OR custom_data->>'ubicacion' = 'https://maps.app.goo.gl/ETiKskuZsWXCYRKx6';
