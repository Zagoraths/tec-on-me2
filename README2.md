# Tec On Me
## Flux de data
**Sources :**
- https://www.transportdata.be/fr/organization/tec
- https://geoportail.wallonie.be/datachallengeLETEC


### 1. APi Tec
- Doc : https://public.opendatasoft.com/explore/dataset/poteaux-tec/table/
- url : https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/poteaux-tec/records?where=within_distance(geo_point_2d%2C%20geom%27POINT(4.491863482729571%2050.05597490916252)%27%2C%201km)&limit=20&lang=fr

On récupère la liste des arrêtes autour du POI renseigné

**data :**
- pot_id : N135akb
- pot_npm_ha : COUVIN Saint-Joseph
- canton : Couvin
- commune : Couvin
- arrondissement : Philippeville
- pot_zone_t : 4135
- geo_point_2d : objet { lat: 50.0540645897544 ,  lon: 4.4787981374445 }

## Sur notre DB
**Source des data : ** https://www.transportdata.be/fr/dataset/tec-gtfs

### Pour chaque arrêt
#### Infos de l'arrêt (facultatif)
- Select ON stops WHERE stop_id = N135akb

**data : **
- stop_name : COUVIN Saint-Joseph
- stop_id : N135akb
- stop_lat : 50.053328
- stop_lon : 4.492958
- zone_id : 4135
- location_type : 0

#### Les bus au passage
- Select ON stop_times WHERE stop_id = N135akb

**data : **
- trip_id : 441998887-N_2024-SC-N3-Sem-N-3-04
- arrival_time : 15:24:00
- departure_time : 15:26:00
- stop_id : N135akb
- stop_sequence
- pickup_type : 1 ?
- drop_off_type: 1 ?

#### Pour chaque bus
##### Infos techniques
- Select ON trips WHERE trip_id = 41998887-N_2024-SC-N3-Sem-N-3-04

**data : **
- trip_id : 41998887-N_2024-SC-N3-Sem-N-3-04
- route_id : N2592-19472
- service_id : N_2024-SC-N3-Sem-N-3-04
- trip_short_name : 3
- direction_id : 0 | 1 (sens ?)
- block_id : 7860500
- shape_id : N25920012

##### Infos sur la ligne
- Select ON routes WHERE route_id = N2592-19472

**data : **
- route_id : N2592-19472
- agency_id : N
- route_short_name : 59/2
- route_long_name : Couvin - Cul-des-Sarts
- route_type : 3 | 0 (0 = métro)

##### Trouver l'agence responsable
- Select ON agency WHERE agency_id : N

**data : **
- agency_id : C
- agency_name : TEC Charleroi
- agency_phone : +32 71 23 41 15

##### Points de passage
- Select ON shapes WHERE shape_id = N25920012 ORDER BY shape_lat_sequence ASC

**data : **
- id : 4239875
- shape_id : N25920012
- shape_pt_lat : 49.941463
- shape_pt_lon : 4.435175
- shape_lat_sequence : 250002

## Notre API
### Routes
#### stops
- GET, stop_id (http://localhost/api_bootcamp/stops/N135akb) + route

### shapes
- GET, shape_id (http://localhost/api_bootcamp/shapes/N15620041)
