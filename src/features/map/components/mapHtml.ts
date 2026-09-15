/**
 * HTML-страница Яндекс Карт для WebView и протокол общения с React Native.
 *
 * В Expo Go используем JavaScript API в WebView: нативный Yandex MapKit требует
 * custom dev client, а значит ломает быстрый запуск через Expo Go.
 */

/** Координаты в приложении — `[долгота, широта]`, как и в WKT у fieldsRepository. */
export type LngLat = [number, number];

/** Куда садимся, если местоположение получить не удалось. */
export const FALLBACK_CENTER: LngLat = [37.6173, 55.7558]; // Москва
export const FALLBACK_ZOOM = 10;

/** Зум при показе местоположения пользователя. */
export const USER_ZOOM = 15;

/** Минимум вершин у контура: меньше — это не многоугольник. */
export const MIN_RING_VERTICES = 3;

/** Сообщения, которые страница присылает в React Native. */
export type MapMessage =
  | { type: 'draft-change'; count: number; selected: number | null; canUndo: boolean }
  | { type: 'ready' }
  | { type: 'error'; message: string; fatal: boolean }
  | { type: 'warning'; message: string }
  | { type: 'center'; center: LngLat }
  | { type: 'drawing-ready' }
  | { type: 'drawing-error'; message: string }
  | { type: 'contour-closed' }
  | { type: 'field-tap'; id: string }
  | { type: 'polygon'; ring: LngLat[] }
  | { type: 'polygon-invalid' };

export function parseMapMessage(raw: string): MapMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const { type } = data as { type?: unknown };

    switch (type) {
      case 'draft-change': {
        const d = data as { count?: unknown; selected?: unknown; canUndo?: unknown };
        if (typeof d.count !== 'number' || !Number.isInteger(d.count) || d.count < 0) return null;
        return { type, count: d.count, selected: typeof d.selected === 'number' ? d.selected : null, canUndo: d.canUndo === true };
      }
      case 'ready':
      case 'drawing-ready':
      case 'contour-closed':
      case 'polygon-invalid':
        return { type };
      case 'error': {
        const { message, fatal } = data as { message?: unknown; fatal?: unknown };
        return {
          type,
          message: typeof message === 'string' ? message : 'unknown',
          fatal: fatal === true,
        };
      }
      case 'warning':
      case 'drawing-error': {
        const { message } = data as { message?: unknown };
        return { type, message: typeof message === 'string' ? message : 'unknown' };
      }
      case 'center': {
        const center = readLngLat((data as { center?: unknown }).center);
        return center ? { type, center } : null;
      }
      case 'field-tap': {
        const { id } = data as { id?: unknown };
        return typeof id === 'string' ? { type, id } : null;
      }
      case 'polygon': {
        const { ring } = data as { ring?: unknown };
        if (!Array.isArray(ring)) return null;
        const points = ring.flatMap((item) => {
          const point = readLngLat(item);
          return point ? [point] : [];
        });
        return points.length >= MIN_RING_VERTICES
          ? { type, ring: points }
          : { type: 'polygon-invalid' };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function readLngLat(value: unknown): LngLat | null {
  if (!Array.isArray(value)) return null;
  const [lng, lat] = value;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

export function flyToScript(center: LngLat, zoom: number): string {
  return `window.__map && window.__map.flyTo(${JSON.stringify({ center, zoom })}); true;`;
}

export function invalidateSizeScript(): string {
  return 'window.__map && window.__map.invalidateSize(); true;';
}

export function requestCenterScript(): string {
  return 'window.__map && window.__map.sendCenter(); true;';
}

export type FieldShape =
  | { id: string; name?: string; crop?: string; ring: LngLat[] }
  | { id: string; name?: string; crop?: string; center: LngLat };

export function setFieldsScript(shapes: FieldShape[]): string {
  return `window.__map && window.__map.setFields(${JSON.stringify(shapes)}); true;`;
}

export function editPolygonScript(ring: LngLat[]): string {
  return `window.__map && window.__map.editPolygon(${JSON.stringify(ring)}); true;`;
}

export function setFieldTapsScript(enabled: boolean): string {
  return `window.__map && window.__map.setFieldTaps(${String(enabled)}); true;`;
}

export function loadDrawingScript(): string {
  return 'window.__map && window.__map.loadDrawing(); true;';
}

export function startPolygonScript(): string {
  return 'window.__map && window.__map.startPolygon(); true;';
}

export type EditorCommand = 'add' | 'move' | 'remove' | 'deselect';
export function editorCommandScript(command: EditorCommand): string {
  return `window.__map && window.__map.editorCommand(${JSON.stringify(command)}); true;`;
}

export function undoScript(): string {
  return 'window.__map && window.__map.undo(); true;';
}

export function finishPolygonScript(): string {
  return 'window.__map && window.__map.finishPolygon(); true;';
}

export function cancelDrawingScript(): string {
  return 'window.__map && window.__map.cancelDrawing(); true;';
}

export function restartPolygonScript(): string {
  return 'window.__map && window.__map.restartPolygon(); true;';
}

export function setEditInteractionScript(editing: boolean): string {
  return `window.__map && window.__map.setEditInteraction(${String(editing)}); true;`;
}

export type MapPalette = {
  background: string;
  /** Заливка полигона поля; ожидается формат `#rrggbbaa`. */
  fieldFill: string;
  fieldStroke: string;
  pointFill: string;
  pointStroke: string;
};

export function buildMapHtml(key: string, palette: MapPalette): string {
  const config = JSON.stringify({
    key,
    center: FALLBACK_CENTER,
    zoom: FALLBACK_ZOOM,
    palette,
    minRingVertices: MIN_RING_VERTICES,
  });

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: ${palette.background}; }
    #map { width: 100%; height: 100%; }
  </style>
  <script>
    var reported = false;
    function send(payload) {
      if (payload.type === 'error') {
        if (reported) return;
        reported = true;
      }
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }
    window.onerror = function (message) {
      send({ type: 'error', message: String(message), fatal: true });
    };
  </script>
  <script
    src="https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU&coordorder=longlat&load=package.full"
    onerror="send({ type: 'error', message: 'yandex-script-load-failed', fatal: true })"
  ></script>
</head>
<body>
  <div id="map"></div>
  <script>
    (function () {
      var config = ${config};
      var map = null;
      var fields = [];
      var fieldTapsEnabled = true;
      var draftPolygon = null;
      var vertices = [];
      var handles = [];
      var history = [];
      var selected = null;
      function snapshot() { history.push(vertices.map(function(p) { return p.slice(); })); if (history.length > 100) history.shift(); }
      function notifyDraft() { send({ type: 'draft-change', count: vertices.length, selected: selected, canUndo: history.length > 0 }); }
      function clearHandles() { handles.forEach(function(h) { map.geoObjects.remove(h); }); handles = []; }
      function renderDraft() {
        clearHandles();
        draftPolygon.geometry.setCoordinates([vertices.length >= 3 ? vertices.concat([vertices[0]]) : vertices]);
        vertices.forEach(function(point, index) {
          var marker = new ymaps.Placemark(point, { iconContent: String(index + 1) }, {
            preset: 'islands#circleIcon', iconColor: selected === index ? '#2563EB' : '#087F5B',
            draggable: true, zIndex: 1000, hideIconOnBalloonOpen: false
          });
          marker.events.add('click', function() { selected = index; renderDraft(); });
          marker.events.add('dragstart', function() { snapshot(); selected = index; });
          marker.events.add('dragend', function() { vertices[index] = marker.geometry.getCoordinates(); renderDraft(); });
          handles.push(marker); map.geoObjects.add(marker);
        });
        notifyDraft();
      }
      function escapeLabel(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

      function cleanRing(ring) {
        var out = [];
        for (var i = 0; i < ring.length; i++) {
          var point = ring[i];
          if (!Array.isArray(point) || typeof point[0] !== 'number' || typeof point[1] !== 'number') continue;
          var prev = out[out.length - 1];
          if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
            out.push([point[0], point[1]]);
          }
        }
        if (out.length > 1) {
          var first = out[0];
          var last = out[out.length - 1];
          if (first[0] === last[0] && first[1] === last[1]) out.pop();
        }
        return out;
      }

      function destroyDraft() {
        clearHandles();
        vertices = []; history = []; selected = null;
        if (!draftPolygon) return;
        try { draftPolygon.editor.stopDrawing(); } catch (e) {}
        try { draftPolygon.editor.stopEditing(); } catch (e) {}
        try { map.geoObjects.remove(draftPolygon); } catch (e) {}
        draftPolygon = null;
      }

      function getDraftRing() {
        if (!draftPolygon) return [];
        return cleanRing(vertices);
      }

      function createDraft(ring) {
        destroyDraft();
        vertices = cleanRing(ring || []);
        draftPolygon = new ymaps.Polygon(
          ring ? [ring] : [[]],
          {},
          {
            fillColor: '#38BDF833',
            strokeColor: '#0284C7',
            strokeWidth: 3,
            editorDrawingCursor: 'crosshair',
            editorMaxPoints: 96
          }
        );
        map.geoObjects.add(draftPolygon);
        renderDraft();
        return draftPolygon;
      }

      function drawFields(shapes) {
        for (var i = 0; i < fields.length; i++) {
          try { map.geoObjects.remove(fields[i]); } catch (e) {}
        }
        fields = [];

        for (var j = 0; j < shapes.length; j++) {
          var shape = shapes[j];
          var object = null;

          if (shape.ring) {
            object = new ymaps.Polygon(
              [shape.ring],
              { fieldId: shape.id, hintContent: escapeLabel(shape.name) },
              {
                fillColor: config.palette.fieldFill,
                strokeColor: config.palette.fieldStroke,
                strokeWidth: 2
              }
            );
          } else if (shape.center) {
            object = new ymaps.Placemark(
              shape.center,
              { fieldId: shape.id },
              {
                preset: 'islands#greenCircleDotIcon',
                iconColor: config.palette.pointFill
              }
            );
          }

          if (!object) continue;
          object.events.add('click', function (event) {
            if (!fieldTapsEnabled) return;
            var target = event.get('target');
            var id = target && target.properties && target.properties.get('fieldId');
            if (id) send({ type: 'field-tap', id: String(id) });
          });
          map.geoObjects.add(object);
          fields.push(object);
          var labelCenter = shape.center;
          if (!labelCenter && shape.ring && shape.ring.length) {
            labelCenter = [0,0];
            shape.ring.forEach(function(p) { labelCenter[0] += p[0] / shape.ring.length; labelCenter[1] += p[1] / shape.ring.length; });
          }
          if (labelCenter && shape.name) {
            var label = new ymaps.Placemark(labelCenter, { fieldId: shape.id,
              iconContent: escapeLabel(shape.name), iconCaption: escapeLabel(shape.crop) },
              { preset: 'islands#darkGreenStretchyIcon', zIndex: 500 });
            label.events.add('click', function(e) {
              if (fieldTapsEnabled) send({ type: 'field-tap', id: String(e.get('target').properties.get('fieldId')) });
            });
            map.geoObjects.add(label); fields.push(label);
          }
        }
      }

      function init() {
        try {
          map = new ymaps.Map(
            'map',
            {
              center: config.center,
              zoom: config.zoom,
              controls: ['zoomControl']
            },
            {
              suppressMapOpenBlock: true,
              yandexMapDisablePoiInteractivity: true
            }
          );

          window.__map = {
            flyTo: function (options) {
              map.setCenter(options.center, options.zoom, { duration: 600 });
            },

            invalidateSize: function () {
              map.container.fitToViewport();
            },

            sendCenter: function () {
              send({ type: 'center', center: map.getCenter() });
            },

            setFields: function (shapes) {
              drawFields(shapes);
            },

            setFieldTaps: function (enabled) {
              fieldTapsEnabled = enabled;
            },

            loadDrawing: function () {
              send({ type: 'drawing-ready' });
            },

            startPolygon: function () {
              try {
                createDraft(null);

                map.behaviors.enable('drag');
              } catch (e) {
                send({ type: 'drawing-error', message: 'draw-start-failed: ' + String(e) });
              }
            },

            editPolygon: function (ring) {
              try {
                createDraft(ring);

                map.behaviors.enable('drag');
                send({ type: 'contour-closed' });
              } catch (e) {
                send({ type: 'drawing-error', message: 'draw-edit-failed: ' + String(e) });
              }
            },

            restartPolygon: function () {
              try {
                createDraft(null);

                map.behaviors.enable('drag');
              } catch (e) {
                send({ type: 'drawing-error', message: 'draw-restart-failed: ' + String(e) });
              }
            },

            setEditInteraction: function () { map.behaviors.enable('drag'); },
            editorCommand: function(command) {
              if (!draftPolygon) return;
              if (command === 'deselect') { selected = null; renderDraft(); return; }
              if (command === 'add') {
                if (vertices.length >= 96) return;
                var point = map.getCenter();
                if (vertices.some(function(p) { return Math.abs(p[0]-point[0]) < 0.0000001 && Math.abs(p[1]-point[1]) < 0.0000001; })) return;
                snapshot();
                if (selected === null) vertices.push(point.slice());
                else vertices.splice(selected + 1, 0, point.slice());
                selected = null;
              } else if (selected !== null && command === 'move') {
                snapshot(); vertices[selected] = map.getCenter().slice();
              } else if (selected !== null && command === 'remove') {
                snapshot(); vertices.splice(selected, 1); selected = null;
              }
              renderDraft();
            },
            undo: function () {
              if (!draftPolygon || !history.length) return;
              vertices = history.pop(); selected = null; renderDraft();
            },

            finishPolygon: function () {
              var ring = getDraftRing();
              if (ring.length < config.minRingVertices) {
                send({ type: 'polygon-invalid' });
                return;
              }
              try { draftPolygon.editor.stopDrawing(); } catch (e) {}
              try { draftPolygon.editor.stopEditing(); } catch (e) {}
              send({ type: 'contour-closed' });
              send({ type: 'polygon', ring: ring });
            },

            cancelDrawing: function () {
              destroyDraft();
              try { map.behaviors.enable('drag'); } catch (e) {}
            }
          };

          send({ type: 'ready' });
        } catch (e) {
          send({ type: 'error', message: 'yandex-map-init-failed: ' + String(e), fatal: true });
        }
      }

      if (typeof ymaps === 'undefined') {
        send({ type: 'error', message: 'ymaps-unavailable', fatal: true });
        return;
      }
      ymaps.ready(init);
    })();
  </script>
</body>
</html>`;
}
