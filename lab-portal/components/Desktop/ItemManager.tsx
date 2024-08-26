import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import ItemService from '../../services/itemService';
import LabService from '../../services/labsService';
import DynamicForm from '../Modals/DynamicForm';
import ConfirmationModal from '../Modals/ConfirmationModal';
import LabPicker from '../LabPicker';
import * as ImagePicker from 'expo-image-picker';

interface Lab {
    lab: number;
    name: string;
    roomNum: string;
    deptId: number;
}

interface Item {
    itemId: number;
    description: string;
    quantity: number;
    serialNum: string;
    picture: string;
    lab: Lab | null;
}

const ItemManager = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [labs, setLabs] = useState<Lab[]>([]); // State to hold all labs
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
    const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        fetchItemsAndLabs(); // Fetch items and labs when the component mounts
    }, []);

    const fetchItemsAndLabs = async () => {
        setLoading(true);
        try {
            // Fetch items and labs concurrently
            const [fetchedItems, fetchedLabs] = await Promise.all([
                ItemService.getItems(),
                LabService.getAllLabs(),
            ]);
    
            // Enrich items with lab details
            const enrichedItems = await Promise.all(fetchedItems.map(async (item) => {
                const lab = await LabService.getLabById(item.lab);
                return { ...item, lab }; // Add the lab details to the item
            }));
    
            setItems(enrichedItems); // Store enriched items in state
            setLabs(fetchedLabs); // Store fetched labs in state
        } catch (error) {
            console.error('Failed to fetch items or labs:', error);
        } finally {
            setLoading(false);
        }
    };
    

    const handleCreateOrUpdateItem = async () => {
        let errors: { [key: string]: string } = {};
    
        if (!selectedItem) {
            errors['item'] = 'Item details are missing.';
        } else {
            if (!selectedItem.description) {
                errors['description'] = 'Description is required.';
            } else if (selectedItem.description.length > 30) {
                errors['description'] = 'Description should not exceed 30 characters.';
            }
    
            if (!selectedLabId) {
                errors['lab'] = 'Lab is required.';
            }
    
            if (selectedItem.quantity <= 0) {
                errors['quantity'] = 'Quantity must be greater than 0.';
            }
    
            if (selectedItem.serialNum && selectedItem.serialNum.length > 30) {
                errors['serialNum'] = 'Serial Number should not exceed 30 characters.';
            }
    
            if (!selectedItem.picture && !imageBase64) {
                errors['picture'] = 'Please upload a valid image.';
            } else if (imageBase64) {
                const base64Prefix = imageBase64.split(',')[0];
                if (!base64Prefix.includes('jpeg') && !base64Prefix.includes('jpg') && !base64Prefix.includes('png')) {
                    errors['picture'] = 'Uploaded image must be a valid JPG, JPEG, or PNG.';
                }
            }
        }
    
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setError('Please fix the highlighted errors.');
            return;
        }
    
        try {
            const itemToSave = {
                ...selectedItem,
                lab: selectedLabId, // Ensure labId is set correctly
                picture: imageBase64 || selectedItem.picture,
            };
    
            if (selectedItem.itemId) {
                await ItemService.updateItem(selectedItem.itemId, itemToSave);
            } else {
                await ItemService.createItem(itemToSave);
            }
            await fetchItemsAndLabs(); // Refresh items and labs after saving
            setFormOpen(false);
            resetForm();
        } catch (error) {
            setError('Failed to save the item. Please try again.');
            console.error('Error saving item:', error);
        }
    };
    

    const handleEdit = (item: Item) => {
        console.log("Editing Item:", item); // Log the item being edited
        console.log("Selected Lab ID:", item.lab ? item.lab.labId : null); // Log the labId being set
        setSelectedLabId(item.lab ? item.lab.labId : null);
        setSelectedItem(item);
        setImageBase64(item.picture);
        setFormOpen(true);
        setError(null);
        setValidationErrors({});
    };
    
    

    const handleDelete = (item: Item) => {
        setItemToDelete(item);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            try {
                await ItemService.deleteItem(itemToDelete.itemId);
                await fetchItemsAndLabs();
            } catch (error) {
                console.error('Failed to delete item:', error);
            } finally {
                setDeleteModalVisible(false);
                setItemToDelete(null);
            }
        }
    };

    const resetForm = () => {
        setSelectedItem(null);
        setSelectedLabId(null);
        setImageBase64(null);
        setError(null);
        setValidationErrors({});
    };

    const handleImagePick = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            base64: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setImageBase64(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
            setValidationErrors((prev) => ({ ...prev, picture: '' }));
        } else {
            Alert.alert('Image selection failed', 'Please try selecting an image again.');
        }
    };

    const formComponents = [
        <View key="descriptionWrapper">
            <Text style={styles.label}>
                Description <Text style={[styles.required, !validationErrors.description && styles.hiddenAsterisk]}>*</Text>
            </Text>
            <TextInput
                style={[styles.input, validationErrors.description ? styles.inputError : null]}
                placeholder="Description (max 30 chars)"
                value={selectedItem?.description || ''}
                maxLength={30}
                onChangeText={(text) => {
                    setSelectedItem((prev) => prev ? { ...prev, description: text } : { itemId: 0, description: text, quantity: 0, serialNum: '', picture: '', labId: selectedLabId });
                    setValidationErrors((prev) => ({ ...prev, description: '' }));
                }}
            />
            {validationErrors.description && <Text style={styles.errorText}>{validationErrors.description}</Text>}
        </View>,
        <View key="labPickerWrapper">
            <Text style={styles.label}>
                Lab <Text style={[styles.required, !validationErrors.lab && styles.hiddenAsterisk]}>*</Text>
            </Text>
            <LabPicker
                selectedLabId={selectedLabId}
                onLabChange={(labId) => {
                    setSelectedLabId(labId);
                    setValidationErrors((prev) => ({ ...prev, lab: '' }));
                }}
            />
            {validationErrors.lab && <Text style={styles.errorText}>{validationErrors.lab}</Text>}
        </View>,
        <View key="quantityWrapper">
            <Text style={styles.label}>
                Quantity <Text style={[styles.required, !validationErrors.quantity && styles.hiddenAsterisk]}>*</Text>
            </Text>
            <TextInput
                style={[styles.input, validationErrors.quantity ? styles.inputError : null]}
                placeholder="Quantity"
                keyboardType="numeric"
                value={selectedItem?.quantity.toString() || ''}
                onChangeText={(text) => {
                    setSelectedItem((prev) => prev ? { ...prev, quantity: parseInt(text) || 0 } : { itemId: 0, description: '', quantity: parseInt(text) || 0, serialNum: '', picture: '', labId: selectedLabId });
                    setValidationErrors((prev) => ({ ...prev, quantity: '' }));
                }}
            />
            {validationErrors.quantity && <Text style={styles.errorText}>{validationErrors.quantity}</Text>}
        </View>,
        <View key="serialNumWrapper">
            <Text style={styles.label}>
                Serial Number
            </Text>
            <TextInput
                style={[styles.input, validationErrors.serialNum ? styles.inputError : null]}
                placeholder="Serial Number (max 30 chars)"
                value={selectedItem?.serialNum || ''}
                maxLength={30}
                onChangeText={(text) => {
                    setSelectedItem((prev) => prev ? { ...prev, serialNum: text } : { itemId: 0, description: '', quantity: 0, serialNum: text, picture: '', labId: selectedLabId });
                    setValidationErrors((prev) => ({ ...prev, serialNum: '' }));
                }}
            />
            {validationErrors.serialNum && <Text style={styles.errorText}>{validationErrors.serialNum}</Text>}
        </View>,
        <View key="picturePickerWrapper">
            <Text style={styles.label}>
                Picture <Text style={[styles.required, !validationErrors.picture && styles.hiddenAsterisk]}>*</Text>
            </Text>
            <Button
                title="Select Picture (JPG, JPEG, PNG)"
                onPress={handleImagePick}
                color="#FFC107"
            />
            <TextInput
                value={imageBase64 || ''}
                style={{ display: 'none' }} // Hidden input to store imageBase64
            />
            {validationErrors.picture && <Text style={styles.errorText}>{validationErrors.picture}</Text>}
        </View>,
        <Button
            key="submit"
            title={selectedItem?.itemId ? 'Update' : 'Create'}
            onPress={handleCreateOrUpdateItem}
            color="#FFC107"
        />,
    ];

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Item Management</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#FFC107" />
            ) : (
                <>
                    <TouchableOpacity style={styles.addButton} onPress={() => setFormOpen(true)}>
                        <Text style={styles.addButtonText}>Add New Item</Text>
                    </TouchableOpacity>

                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellImage]}>Image</Text>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellDescription]}>Description</Text>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellQuantity]}>Quantity</Text>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellSerialNum]}>Serial Number</Text>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellLab]}>Lab</Text>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellActions]}>Actions</Text>
                    </View>

                    <FlatList
                        data={items}
                        keyExtractor={(item) => item.itemId.toString()}
                        renderItem={({ item }) => (
                            <View style={styles.entryRow}>
                                <View style={styles.tableCellImage}>
                                    {item.picture ? (
                                        <Image
                                            source={{ uri: item.picture.startsWith('data:image') ? item.picture : `data:image/jpeg;base64,${item.picture}` }}
                                            style={styles.itemImage}
                                        />
                                    ) : (
                                        <Text>No Image</Text>
                                    )}
                                </View>
                                <View style={styles.tableCellDescription}>
                                    <Text>{item.description}</Text>
                                </View>
                                <View style={styles.tableCellQuantity}>
                                    <Text>{item.quantity}</Text>
                                </View>
                                <View style={styles.tableCellSerialNum}>
                                    <Text>{item.serialNum}</Text>
                                </View>
                                <View style={styles.tableCellLab}>
                                    <Text>{item.lab?.name} - {item.lab?.roomNum}</Text>
                                </View>
                                <View style={styles.tableCellActions}>
                                    <TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconButton}>
                                        <Image source={require('../../assets/edit.png')} style={styles.iconImage} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconButton}>
                                        <Image source={require('../../assets/trash.png')} style={styles.iconImage} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    />
                    <DynamicForm
                        visible={isFormOpen}
                        title={selectedItem?.itemId ? 'Update Item' : 'Add Item'}
                        onClose={() => {
                            setFormOpen(false);
                            resetForm();
                        }}
                        components={[formComponents]} 
                        error={error}
                    />

                    <ConfirmationModal
                        visible={isDeleteModalVisible}
                        title={<Text>Confirm Deletion</Text>}
                        description={<Text>Are you sure you want to delete this item? This action cannot be undone.</Text>}
                        onConfirm={confirmDelete}
                        onCancel={() => setDeleteModalVisible(false)}
                        type="yesNoDanger"
                    />
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    addButton: {
        backgroundColor: '#ffc107',
        padding: 10,
        borderRadius: 5,
        marginBottom: 20,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
    },
    tableHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        backgroundColor: '#f0f0f0',
    },
    tableHeaderCell: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    tableHeaderCellImage: {
        flex: 1,
    },
    tableHeaderCellDescription: {
        flex: 3,
    },
    tableHeaderCellQuantity: {
        flex: 1,
    },
    tableHeaderCellSerialNum: {
        flex: 2,
    },
    tableHeaderCellLab: {
        flex: 2,
    },
    tableHeaderCellActions: {
        flex: 2,
    },
    entryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    tableCellImage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableCellDescription: {
        flex: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableCellQuantity: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableCellSerialNum: {
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableCellLab: {
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableCellActions: {
        flex: 2,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemImage: {
        width: 50,
        height: 50,
        borderRadius: 5,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        borderRadius: 5,
        marginBottom: 10,
        height: 40,
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
    },
    required: {
        color: 'red',
    },
    hiddenAsterisk: {
        color: 'transparent',
    },
    inputError: {
        borderColor: 'red',
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 2,
    },
    iconButton: {
        marginHorizontal: 5,
    },
    iconImage: {
        width: 20,
        height: 20,
    },
});

export default ItemManager;
