;(function ( $, window, document, undefined ) {
	/*
	 * Google Map based geolocator for user input
	 * Dependencies:
	 * - GoogleMaps API 
	 * - jquery-1.8.3 for positioning
	 * - jquery ui for drag/drop
	 * 
	 * @author: Marcos Palacios
	 */

	// Needed for screen to map coordinates 
	function DummyOView( map ) {
		// Bind this to the map to access MapCanvasProjection
		this.setMap( map );
		// MapCanvasProjection is only available after draw has been called.
		this.draw = function() {};
	}
	
	DummyOView.prototype = new google.maps.OverlayView();

	/**
	 * PRIVATE METHODS
	 * i.e. they must be called within the object scope ! 
	 */
	
	var _getFileExtension = function( filename ) {
		if( typeof filename === 'string' )
			return filename.split( '.' ).pop();
		return "";
	};
	
	var _getShadowedImage = function( imageName ) {
		var ext = _getFileExtension( imageName );
		return imageName.replace( "." + ext, "_shadow." + ext );
	};
	
	/**
	 * Creates a map marker after a drag&drop gesture, based on input parameters:
	 * - evt: the jQuery drop event
	 * - draggable: the dropped element
	 * - droppable: the element to which the draggable has ben dropped
	 * 
	 */
	var _createMarker = function( params ) {
		if( typeof params.event !== 'undefined' &&
				typeof params.draggable !== 'undefined' &&
				typeof params.droppable !== 'undefined' ) {
			
			// define dropped image
			var droppedImage = ( params.draggable.is( 'img' )? params.draggable.attr( 'src' ) : 
					params.draggable.first( 'img' ).attr( 'src' ) );

			var gmOptions = this.options;
			
			if( typeof droppedImage === 'undefined' || 
					droppedImage == null || 
					droppedImage == "" ) {
				droppedImage = gmOptions.defaultMarker;
			}
			
			var options = { coords: _getCoordinates.call( this, params.draggable ),
					        uid: _getUID.call( this ),
					        icon: droppedImage
					      };
			return _addMarker.call( this, options );
		}
		return null;
	};
	
	/**
	 * Calculates coordinates from an (x,y) screen point
	 * Expect:
	 * - evt: drop event for viewport coordinates
	 * - obj: object dropped
	 * 
	 */
	var _getCoordinates = function( obj ) {
		
		var map = this.gmMap;
		var dummy = this.gmDummy;
		
		if( typeof map !== 'undefined' &&
				typeof dummy !== 'undefined' && 
				typeof obj !== 'undefined' ) {
			var gd = $( map.getDiv() );
			if ( gd ) {
				var mLeft = gd.offset().left;
				var mTop = gd.offset().top;
				
				var oHeight = $( obj ).outerHeight();
				var oWidth = $( obj ).outerWidth();
				var oPageX = $( obj ).offset().left + ( oWidth/2 );
				var oPageY = $( obj ).offset().top + ( oHeight );

			    var pixelpoint = new google.maps.Point( oPageX - mLeft, oPageY - mTop );

			    // Corresponding geo point on the map
			    var proj = dummy.getProjection();
			    return proj.fromContainerPixelToLatLng( pixelpoint );
			}
		}
	};

	/**
	 * Geolocates a maker based on its coordinates.
	 * No reply, triggers an 'markerlocated' on the map's container.
	 */
	var _geolocate = function( marker ) {
		var geocoder = this.gmGeocoder;
		var map = this.gmMap;
		
		if( marker && geocoder ) {
			geocoder.geocode( {
				latLng: marker.getPosition()
			}, function( responses ) {
				var data = { marker: marker, lat: marker.getPosition().lat(), lon: marker.getPosition().lng() };
				if ( responses && responses.length > 0) {
					var address = null;
					for( var i=0; i<responses.length; i++ ) {
						if( $.inArray( "street_address", responses[i].types ) != -1 ||
							$.inArray( "route", responses[i].types ) != -1) {
							address = responses[ i ];
							break; 
						}
					}
					data.details = address;
					if( address != null ) {
						marker.item.loc = address.formatted_address;
					} else marker.item.loc = 'NO_ADDRESS_AVAILABLE';
				} else {
					marker.item.loc = 'NO_ADDRESS_AVAILABLE';
				}
				$( map.getDiv() ).trigger( 'markerlocated', data );
			});
		}
	};
	
	
	/**
	 * Adds a marker into the map, expects as input:
	 * - map to where add the marker
	 * - coordinates of the marker
	 * - unique id for the marker
	 * - icon to be used for the marker
	 * 
	 */
	var _addMarker = function( options ) {
		
		var marker = null;

		var item = { uid: options.uid, type: options.icon, loc: options.loc };
		
		if( typeof options.coords !== 'undefined' ) {
			marker = new google.maps.Marker({
				position: options.coords,
				map: this.gmMap,
				icon: ( this.options.addMarkerShadow ? _getShadowedImage.call( this, options.icon ) : options.icon ),
				draggable: true
			});	
			marker.item = item;

			this.gmMarkers.push( marker );
			
			var context = this;
			google.maps.event.addListener( marker, 'click', function() {
				$( context.gmMap.getDiv() ).trigger( 'markerselected', { marker: marker } );
			});
			google.maps.event.addListener( marker, 'dragstart', function() {
				if( context.options.addMarkerShadow ) {
					marker.setIcon( marker.getIcon().replace( "_shadow", "" ) );
				}
				$( context.gmMap.getDiv() ).trigger( 'markerselected', { marker: marker } );
				
			});
			google.maps.event.addListener( marker, 'dragend', function() {
				if( context.options.addMarkerShadow ) {
					marker.setIcon( _getShadowedImage.call( context, marker.getIcon() ) );
				}
				_geolocate.call( context, this );
			});
			
			if( typeof options.loc === 'undefined' ||
					options.loc == null )
				_geolocate.call( this, marker );
			else {
				marker.item.details = { 'formatted-address' : options.loc };
			}
		}
		return marker;
	};

	/**
	 * Place the search input relative to map.
	 */
	var _placeSearch = function() {
		var map = this.gmMap;
		if( typeof map !== 'undefined' &&
				typeof this.gmSearch !== 'undefined' ) {
			
			this.gmSearch.position( {
					my: "center top+15",
					at: "center top",
					of: $( map.getDiv() ),
					collision: "none"
				} ).css( { 'z-index' : '999' } );
		}
	};

	/**
	 * Place the dropper.
	 * Check if it's been wrapped around to place the wrap 
	 * instead of the dropper itself.
	 * 
	 */
	var _placeDropper = function( dropper ) {
		var map = this.gmMap;
		if( typeof map !== 'undefined' &&
				typeof dropper !== 'undefined' ) {
			
			var d = dropper;
			var css = { 'z-index' : '999' };
			if( dropper.parent().hasClass( 'gmCircleWrapper' ) ||
					dropper.parent().hasClass( this.options.dropperWrapClass ) ) {
				d.css( { 'position' : 'relative' } );
				d.parent().css( 'z-index', '998' ).position( {
					my: "center top",
					at: "left+100 top+15",
					of: $( map.getDiv() ),
					collision: "none"
				} );
			}
			else {
				d.css( css ).position( {
						my: "center top",
						at: "left+100 top",
						of: $( map.getDiv() ),
						collision: "none"
					} );
			}
		}
	};
	
	var _init = function() {
		
		var context = this;
		
		// Dropped image reference for newly added markers  
		this.currentDropIcon = this.options.defaultMarker;
		
		// Set up map type
		switch( this.options.type ) {
			case 'ROADMAP':
			case 'SATELLITE':
			case 'HYBRID':
			case 'TERRAIN':
				this.options.type = google.maps.MapTypeId[ this.options.type ];
				break;
			default:
				this.options.type = google.maps.MapTypeId.ROADMAP;
				break;
		}
		
		/**
		 * Private Unique IDentifier for the associated markers.
		 */
		this.UID = 1;
		
		// Adjust container 
		if( this.options.fullscreen ) {
			$( 'body' ).css( { 'padding' : '0', 'margin' : '0' } );
			$( this.element ).css ( {
				    'background-color' : 'rgba(0, 0, 0, 0)',
				    'height' : '100%',
				    'left': '0',
				    'margin' : '0',
				    'padding': '0',
				    'position': 'absolute',
				    'top': '0',
				    'width': '100%',
				    'z-index': '-2'
			} );
		}
		
		// Init map
		var map = new google.maps.Map( this.element, {
			zoom: this.options.zoom,
	        center: new google.maps.LatLng( this.options.center[ 0 ], this.options.center[ 1 ] ),
	        mapTypeId: this.options.type
		} );

		/**
		 * Add a dummy overlay for later use.
		 * Needed for API v3 to convert pixels to latlng. 
		 */
		var dummy = new DummyOView( map );
		
		/**
		 * Check if the user wants an autocomplete added in top of the map.
		 * For that, the plugin can be initialized with:
		 * - true
		 * - input text id
		 * - jQuery object of an input[type=text]
		 */
		var search = null;
		var sTarget = null;
		
		if( jQuery.type( this.options.search ) !== 'boolean' || this.options.search != false ) {
			if( this.options.search == true ) {
				sTarget = $( '<input type="text" id="gmUserInput_' + $( this.element ).attr( 'id' ) + '_search"></input>' ).css( { "width" : "300px" } );
			}
			if( jQuery.type( this.options.search ) === 'string' ) {
				sTarget = $( '#' + this.options.search );
			} else if( this.options.search instanceof jQuery ) {
				sTarget = this.options.search;
			}
			if( sTarget != null &&
					sTarget.length > 0 &&
					sTarget.is( 'input:text' ) ) {
				$( this.element ).append( sTarget );
				search = new google.maps.places.Autocomplete( sTarget[0], { types: ['geocode'] } );
			}
		}
		
		/**
		 * Check if dropper requested.
		 * The dropper can be:
		 * - null, so display the default dropper
		 * - jQuery selector of element(s) that will be used as a dropper(s) ( must be draggable )
		 * - jQuery object of the element(s) that will be used as a dropper(s) ( must be draggable )
		 */
		var d = null;
		
		if ( this.options.dropper == null ) {
			var img = $( '<img src="' + this.options.defaultMarker + '">' ).css( {
				 "border": "none",
				 "box-shadow": "none",
				 "margin" : "0",
				 "padding" : "0"

			} );
			d = $( "<div>" ).append( img ).css( {
										 "width" : "25px",
										 "height" : "34px",
										 "position" : "relative",
										 "top" : "12px",
										 "left" : "12px",
										 "z-index" : "999"
									} );
			$( this.element ).append( d );
		}
		else if( jQuery.type( this.options.dropper ) === 'string' ) {
			d = $( this.options.dropper );
			if( d.parent().hasClass( this.options.dropperWrapClass ) ) {
				$( this.element ).append( d.parent().css( 'position', 'relative' ) );
			} else 
				$( this.element ).append( d.css( { "position" : "relative" } ) );
		} else if( this.options.dropper instanceof jQuery ) {
			if( d.parent().hasClass( this.options.dropperWrapClass ) ) {
				$( this.element ).append( d.parent().css( 'position', 'relative' ) );
			} else {
				d = this.options.dropper.css( { "position" : "absolute" } );
			}
		}
		
		if( d != null ) {
			d.attr( 'title', this.options.dropperTitle ).draggable( {
				revert: ( !this.options.singleMarker ),
				containment: this.element,
				scroll: false,
				start: function( event, ui ) {
					$( this ).css( 'z-index', '15000' );
				}
			});
			
			/**
			 * Wrap marker and set the correspoding class,
			 * unless the marker has already a parent with the class defined in option 'dropperWrapClass'.
			 * Only add default background settings if dropperWrapClass is the plugin internal default: gmiuiMarkerBackground. 
			 */
			if( this.options.dropper == null || 
					( this.options.dropperWrap && !d.parent().hasClass( this.options.dropperWrapClass ) ) ) {
				
				var wrap = $( '<div class="' + this.options.dropperWrapClass + '">' );
				if( this.options.dropperWrapClass == 'gmuiWrapClass' )
					wrap.css( { 'background-image' : 'url( /images/gmCircle.png )',
											   'width' : '60px',
											   'height' : '56px' } );
				d.wrap( wrap ).position( {
					my: "center",
					at: "center",
					of: d.parent()
				} );
			}
			
			/**
			 * If single marker ( nos siblings ) and predefined parent container, center the marker
			 */
			if ( d.parent().hasClass( this.options.dropperWrapClass ) &&
					d.siblings().size() == 0 ) {
				d.position( {
					my: "center",
					at: "center",
					of: d.parent()
				} );
			}
			
			
			/**
			 * Make the map container droppable.
			 */
	 		$( map.getDiv() ).droppable( {
	 			 drop: function( evt, ui ) {
	 				
	 				/**
	 				 * This handles a drop of an external element
	 				 */
	 				if( typeof ui.draggable.data === 'undefined' ||
	 					typeof ui.draggable.data( 'info' ) === 'undefined' ) {
	 					
		 			 	var marker = _createMarker.call( context, { event: evt, draggable: $( ui.draggable ), droppable: $( this ) }  );
		 			 	if( marker != null ) {
		 			 		$( this ).trigger( 'markeradded', { marker: marker } );
		 			 	}
	 				}
	 		 	 }
	 		} );
		}
		
		/**
		 * Map markers
		 */
		this.gmMap = map;
		this.gmDummy = dummy;
		this.gmMarkers = [];
		this.gmSearch = sTarget;
		this.gmGeocoder = new google.maps.Geocoder();
		
		/**
		 * If input search added, position it and add change 
		 * listener to search box
		 */ 
		if( sTarget != null && search != null ) {
			if( this.options.fullscreen ) {
				sTarget.css( { 
					"position" : "absolute",
					"top" : "12px",
					"left" : "50%",
					"margin-left" : "-" + ( sTarget.width()/2 ) + "px",
					"z-index" : "999"
				} );
			} else {
				_placeSearch.call( this );
			}
			
    		google.maps.event.addListener( search, 'place_changed', function() {
    			var place = search.getPlace();
    		  	if ( place.geometry.viewport ) {
    		    	map.fitBounds( place.geometry.viewport );
    		  	} else {
    			    map.setCenter( place.geometry.location );
    			    map.setZoom( 17 );
    		  	}
    		} );        
		}
		
		/**
		 * Place the dropper
		 */
		if( d != null ) {
			_placeDropper.call( this, d );
		}
	};
	
	/**
	 * Simple sequencer for map markers
	 * @returns unique identifier for the marker, best effort to make it unique within page
	 */
	var _getUID = function() {
		return 'gmlMarker' + $( this.element ).attr( 'id' ) + this.UID++;
	};

	var pluginName = 'gmUserInput',
		defaults = {
			zoom: 15,
			fullscreen: false,
			search: false,
			center: [ 43.540289, -5.653692 ],
			dropper: null,
			dropperTitle: 'Drop me in the map',
			dropperWrap: true,
			dropperWrapClass: 'gmuiWrapClass',
			type: "ROADMAP",
			defaultMarker: '/images/default_marker.png',
			addMarkerShadow: false,
			singleMarker: false
		};
	
	/**
	 * Constructor
	 */
	function gmUserInput( element, options ) {
		
		this.element = element;
		
		this.options = $.extend( {}, defaults, options );

		this._defaults = defaults;
		this._name = pluginName;
		
		_init.call( this );
	}
	
	/**
	 * Centers map in the provided marker.
	 * If the input marker is a string, it assumes it corresponds to the uid of an
	 * already existing marker.
	 * Otherwise, it assues it is a Google Marker object
	 * @param marker marker id or Google Marker object
	 */
	gmUserInput.prototype.centerMapInMarker = function( marker ) {
		if( typeof marker !== 'undefined' &&
				marker != null ) {

			if( typeof marker === 'string' ) {
				for( var i=0; i<this.gmMarkers.length; i++ ) {
					if( marker == this.gmMarkers[ i ].item.uid ) {
						this.centerMapInMarker( this.gmMarkers[ i ] );
					}
				}
			}
			else
				this.gmMap.setCenter( marker.getPosition() );
		}
	};
	
	/**
	 * Centers map in provided coordinates
	 * @param lat
	 * @param lon
	 */
	gmUserInput.prototype.centerMapInLatLon = function( lat, lon ) {
		var myLatLng = new google.maps.LatLng( lat, lon );
		this.map.setCenter( myLatLng );	
	};
	
	gmUserInput.prototype.getMarkers = function() {
		return this.gmMarkers;
	};
	
	/**
	 * Returns a list of simplified information for a marker:
	 * - uid: marker uid
	 * - lat: marker latitude
	 * - lon: marker longitude
	 * - loc: marker formatted address
	 * - icon: marker icon
	 * 
	 * This could helpful for server DB update with user input
	 */
	gmUserInput.prototype.getMarkersAsItems = function() {
		var markers = [];
		for( var i = 0; i<this.gmMarkers.length; i++ ) {
			markers.push( {
				uid: this.gmMarkers[ i ].item.uid,
				lat: this.gmMarkers[ i ].getPosition().d,
				lon: this.gmMarkers[ i ].getPosition().e,
				loc: this.gmMarkers[ i ].item.details.formatted_address,
				icon: this.gmMarkers[ i ].item.type
			} );
		}
		return markers;
	};
	
	/**
	 * Adds a list of markers to the map
	 * @param markers the list of { lat, lon, icon } markers
	 */
	gmUserInput.prototype.addMarkers = function( markers ) {
		if( $.isArray( markers ) ) {
			for( var i = 0; i<markers.length; i++ ) {
				this.addMarker( markers[ i ] );
			}
		}
	};
	
	/**
	 * Adds a marker to the map
	 * @param marker item { lat, lon, icon }
	 */
	gmUserInput.prototype.addMarker = function( marker ) {

		_addMarker.call( this, { uid: ( typeof marker.uid !== 'undefined' ? marker.uid : _getUID.call( this ) ), 
					 icon: ( typeof marker.icon !== 'undefined' ? marker.icon : this.currentDropIcon ),
					 coords: new google.maps.LatLng( marker.lat, marker.lon ),
					 loc: ( typeof marker.loc !== 'undefined' ? marker.loc : null )
					 } );
	};
	
    $.fn[ pluginName ] = function ( options ) {
        return this.each(function () {
            if ( !$.data(this, pluginName ) ) {
                $.data( this, pluginName, 
                new gmUserInput( this, options ) );
            }
        });
    };
})( jQuery, window, document );