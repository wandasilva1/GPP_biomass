// Load NPP and GPP collections from MODIS
var gpp = ee.ImageCollection("MODIS/061/MOD17A2HGF"),
    npp = ee.ImageCollection("MODIS/061/MYD17A3HGF"),
    ucs = ee.FeatureCollection("projects/ee-wandasilva1/assets/uc_wgs84");

// Set map location and zoom level to focus on the study area
Map.centerObject(ucs, 11);

// Add the shapefile layer for Tijuca National Park
Map.addLayer(ucs, false, 'Tijuca_shapefile');

// Define date ranges for NPP and GPP
var startdateNPP = ee.Date.fromYMD(2021, 1, 1);
var enddateNPP = ee.Date.fromYMD(2023, 1, 1);

var startdateGPP = ee.Date.fromYMD(2021, 1, 1);
var enddateGPP = ee.Date.fromYMD(2023, 1, 1);

// Filter NPP collection by date and location
var nppCollection = npp.filterDate(startdateNPP, enddateNPP)
    .filterBounds(ucs)
    .select("Npp");
print(nppCollection);

// Filter GPP collection by date and location
var gppCollection = gpp.filterDate(startdateGPP, enddateGPP)
    .filterBounds(ucs)
    .select("Gpp");
print(gppCollection);

// Calculate annual NPP (npp8) using GPP and NPP data
var myNpp = function(myimg){
     // Get image date
     var d = ee.Date(myimg.get('system:time_start'));
     // Extract the year
     var y = d.get('year').toInt();

     // Filter GPP and NPP for the same year
     var GPPy = ee.Image(gppCollection.filter(ee.Filter.calendarRange(y, y, 'year')).sum());
     var NPPy = ee.Image(nppCollection.filter(ee.Filter.calendarRange(y, y, 'year')).mean());
     
     // Calculate npp8 using the formula
     var npp8 = myimg.expression('(GGP8 / GPPy) * NPPy', {
        GGP8: myimg,
        GPPy: GPPy,
        NPPy: NPPy
     });

     return npp8.copyProperties(myimg, ['system:time_start']);
};

var npp8Collection = ee.ImageCollection(gppCollection.map(myNpp));

// Visualization settings for npp8
var npp_viz = {min: 0.0, max: 1500, palette: "green,yellow,red"};

// Add the npp8 layer to the map
Map.addLayer(npp8Collection.mean().clip(ucs), npp_viz, "npp8_Tijuca");

// Visualization settings for GPP
var gpp_viz = {min: 0.0, max: 1500, palette: "green,yellow,red"};

// Add the GPP layer to the map
Map.addLayer(gppCollection.mean().clip(ucs), gpp_viz, "gpp_Tijuca");

// Calculate biomass production from NPP
var Biomass = function(myimg){
  var biomass = myimg.multiply(2.5);
  return biomass.copyProperties(myimg, ['system:time_start']);
};

// Apply biomass calculation to the npp8 collection
var biomassCollection = npp8Collection.map(Biomass);

// Visualization settings for biomass
var biomass_viz = {min: 300, max: 1500, palette: "green,yellow,red"};

// Add biomass layer to the map
Map.addLayer(biomassCollection.mean().clip(ucs), biomass_viz, 'Biomass_Tijuca');

// Define a specific dry period for visualization (2022)
var vizStartDate = ee.Date.fromYMD(2022, 3, 21);
var vizEndDate = ee.Date.fromYMD(2022, 9, 20);

// Filter NPP collection for the specific dry period
var npp8CollectionViz = npp8Collection.filterDate(vizStartDate, vizEndDate);
Map.addLayer(npp8CollectionViz.mean().clip(ucs), npp_viz, "dry NPP tijuca 22");

// Filter GPP collection for the specific dry period
var gppCollectionViz = gppCollection.filterDate(vizStartDate, vizEndDate);
Map.addLayer(gppCollectionViz.mean().clip(ucs), gpp_viz, "dry GPP tijuca 22");

// Filter biomass collection for the specific dry period
var biomassCollectionViz = biomassCollection.filterDate(vizStartDate, vizEndDate);
Map.addLayer(biomassCollectionViz.mean().clip(ucs), biomass_viz, "dry biomass tijuca 22");

// Define additional date ranges to analyze other periods
// ...

// Define and plot charts for biomass, NPP, and GPP over time
var title = {
  title: 'Biomass Production in Tijuca National Park',
  hAxis: {title: 'Time'},
  vAxis: {title: 'Biomass (Kg/m²)'},
};
var biomassMwea = ui.Chart.image.seriesByRegion(
  biomassCollection,
  ucs.geometry().bounds(),
  ee.Reducer.mean(),
  'Gpp', 500,
  'system:time_start'
).setOptions(title);
print(biomassMwea);

// Additional charts for NPP and GPP
// ...

// Create a legend panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

// Create the legend title
var legendTitle = ui.Label({
  value: 'Biomass in Tijuca National Park',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
  }
});

// Add the title to the legend panel
legend.add(legendTitle);

// Define colors and labels for the legend
var palette = ['green','yellow','red'];
var names = ['0-500 (Kg/m²)','501-1000 (Kg/m²)','1001-1500 (Kg/m²)'];

// Create a legend item for each class
for (var i = 0; i < palette.length; i++) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: palette[i],
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });
  var description = ui.Label({
    value: names[i],
    style: { margin: '0 0 4px 6px' }
  });
  var legendItem = ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
  legend.add(legendItem);
}

// Add the legend to the map
Map.add(legend);

// Define export parameters and export images to Google Drive as GeoTIFF
// Example export for biomass from 2021 to 2022
Export.image.toDrive({
  image: biomassCollection.mean().clip(ucs),
  description: 'Biomass_2021-2022_ucs',
  scale: 500,
  region: ucs.geometry().bounds(),
  fileFormat: 'GEOTIFF',
  maxPixels: 1e13
});

// Additional exports for other variables and periods